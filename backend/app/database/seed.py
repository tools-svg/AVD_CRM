import os
import shutil
import logging
import datetime
import base64
import io
from typing import Optional
from sqlalchemy.orm import Session
from app.database.session import SessionLocal, Base, engine, ensure_schema_compatibility
from app.models.all_models import (
    Role,
    Company,
    User,
    UserCompanyAssignment,
    Project,
    Module,
    Update,
    Attachment,
    StickyNote,
    StickyNoteMention,
    Notification,
    GanttDependency,
    UIConfiguration,
    ActivityLog,
    ProjectEmployeeAssignment
)
from app.core.security import get_password_hash
from app.core.config import settings
from app.services.project_service import calculate_and_update_project_progress

logger = logging.getLogger("avd.database")


def resolve_image_file(rel_path: str) -> Optional[str]:
    """Find an image file on disk from relative paths like /logos/1.png or /uploads/..."""
    if not rel_path or rel_path.startswith("data:image/"):
        return None

    clean = rel_path.lstrip("/\\")
    backend_app_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.abspath(os.path.join(backend_app_dir, "..", ".."))
    root_dir = os.path.abspath(os.path.join(backend_dir, ".."))

    candidates = [
        rel_path,
        clean,
        os.path.join(settings.UPLOAD_DIR, os.path.basename(clean)),
        os.path.join(backend_dir, "uploads", os.path.basename(clean)),
        os.path.join(root_dir, "frontend", "public", clean),
        os.path.join(root_dir, "frontend", "public", "logos", os.path.basename(clean)),
        os.path.join(root_dir, "frontend", "dist", clean),
        os.path.join(root_dir, "frontend", "dist", "logos", os.path.basename(clean)),
        os.path.join("/usr/share/nginx/html", clean),
        os.path.join("/usr/share/nginx/html", "logos", os.path.basename(clean)),
        os.path.join("/app", "uploads", os.path.basename(clean)),
    ]

    for cand in candidates:
        if cand and os.path.isfile(cand):
            return cand
    return None


def image_to_base64_data_uri(image_path_or_url: str) -> Optional[str]:
    """
    Converts a local disk image path or relative image URL into a self-contained
    Base64 Data URI so it can be stored directly in the database and rendered
    by any client on any machine.
    """
    if not image_path_or_url:
        return None
    if image_path_or_url.startswith("data:image/"):
        return image_path_or_url

    local_path = resolve_image_file(image_path_or_url)
    if not local_path:
        return None

    try:
        ext = os.path.splitext(local_path)[1].lower()
        with open(local_path, "rb") as f:
            contents = f.read()
        if not contents:
            return None

        if ext == ".svg":
            b64_str = base64.b64encode(contents).decode("utf-8")
            return f"data:image/svg+xml;base64,{b64_str}"

        try:
            from PIL import Image
            img = Image.open(io.BytesIO(contents))
            img.thumbnail((512, 512), Image.Resampling.LANCZOS)
            out_buf = io.BytesIO()
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img.save(out_buf, format="PNG", optimize=True)
                mime = "image/png"
            else:
                img.convert("RGB").save(out_buf, format="JPEG", quality=85, optimize=True)
                mime = "image/jpeg"
            b64_str = base64.b64encode(out_buf.getvalue()).decode("utf-8")
            return f"data:{mime};base64,{b64_str}"
        except Exception:
            b64_str = base64.b64encode(contents).decode("utf-8")
            mime = "image/png" if ext == ".png" else "image/jpeg"
            return f"data:{mime};base64,{b64_str}"
    except Exception as exc:
        logger.warning("Failed to encode %s to base64 data URI: %s", local_path, exc)
        return None


def migrate_local_images_to_db(db: Session):
    """
    Migrates any disk/path-based logos and avatars in the database to base64 Data URIs
    so they persist directly in the DB and display everywhere.
    """
    try:
        updated = False
        companies = db.query(Company).all()
        for comp in companies:
            if comp.logo_url and not comp.logo_url.startswith("data:image/"):
                data_uri = image_to_base64_data_uri(comp.logo_url)
                if data_uri:
                    comp.logo_url = data_uri
                    updated = True
                    logger.info("Migrated logo to DB data URI for company '%s' (%s)", comp.name, comp.code)

        users = db.query(User).all()
        for u in users:
            if u.avatar_url and not u.avatar_url.startswith("data:image/") and not u.avatar_url.startswith("http"):
                data_uri = image_to_base64_data_uri(u.avatar_url)
                if data_uri:
                    u.avatar_url = data_uri
                    updated = True
                    logger.info("Migrated avatar to DB data URI for user '%s'", u.username)

        if updated:
            db.commit()
    except Exception as exc:
        logger.warning("Image migration skipped or failed non-critically: %s", exc)
        db.rollback()


def seed_database():
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility(engine)
    db: Session = SessionLocal()

    try:
        # Migrate any previously uploaded disk images to DB data URIs
        migrate_local_images_to_db(db)

        if db.query(User).first():
            logger.info("Users already exist. Skipping initial seed.")
            return

        logger.info("Seeding roles...")
        roles_data = [
            ("Developer", "Full administrative access and UI customization system"),
            ("Director", "Cross-company oversight, full CRUD, Gantt and public project sharing"),
            ("Project Manager", "Same as Director, except project deletion is prohibited"),
            ("Manager", "Restricted to assigned sub-company projects and team"),
            ("Employee", "Assigned projects, modules, personal notes, comments, and updates"),
            ("End User", "External read-only stakeholder via tokenized link")
        ]
        role_map = {}
        for name, desc in roles_data:
            r = db.query(Role).filter(Role.name == name).first()
            if not r:
                r = Role(name=name, description=desc)
                db.add(r)
                db.flush()
            role_map[name] = r

        logger.info("Seeding sub-companies...")
        companies_data = [
            ("AVD Tech Systems", "AVD-TECH", "/logos/1.png", "Core sovereign engineering, cloud meshes and high-throughput pipelines."),
            ("AVD Capital & Holdings", "AVD-CAP", "/logos/2.png", "Institutional fiduciary capital, underwriting and cross-currency platforms."),
            ("AVD Life Sciences", "AVD-BIO", "/logos/3.png", "Molecular diagnostics, peptide assays and precision therapeutics.")
        ]
        company_map = {}
        for name, code, logo, desc in companies_data:
            c = db.query(Company).filter(Company.code == code).first()
            if not c:
                db_logo = image_to_base64_data_uri(logo) or logo
                c = Company(name=name, code=code, logo_url=db_logo, description=desc)
                db.add(c)
                db.flush()
            company_map[code] = c

        logger.info("Seeding users...")
        users_data = [
            ("developer", "dev@avdgroup.com", "dev123", "Alex Dev", "/logos/1.png", "Developer", ["AVD-TECH", "AVD-CAP", "AVD-BIO"]),
            ("director", "director@avdgroup.com", "dir123", "Elena Vance", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150", "Director", ["AVD-TECH", "AVD-CAP", "AVD-BIO"]),
            ("pm", "pm@avdgroup.com", "pm123", "Marcus Vance", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150", "Project Manager", ["AVD-TECH", "AVD-CAP", "AVD-BIO"]),
            ("manager", "manager@avdgroup.com", "mgr123", "Sarah Lin", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150", "Manager", ["AVD-TECH"]),
            ("employee", "employee@avdgroup.com", "emp123", "Julian Thorne", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", "Employee", ["AVD-TECH"]),
            ("claire", "claire@avdgroup.com", "emp123", "Claire Fontaine", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150", "Employee", ["AVD-CAP"])
        ]

        user_map = {}
        for username, email, pw, full_name, avatar, role_name, comp_codes in users_data:
            db_avatar = image_to_base64_data_uri(avatar) if (avatar and not avatar.startswith("http")) else avatar
            u = User(
                username=username,
                email=email,
                hashed_password=get_password_hash(pw),
                full_name=full_name,
                avatar_url=db_avatar,
                role_id=role_map[role_name].id,
                is_active=True
            )
            db.add(u)
            db.flush()
            user_map[username] = u

            for cc in comp_codes:
                db.add(UserCompanyAssignment(user_id=u.id, company_id=company_map[cc].id))

        db.commit()

        # Seed sample upload images
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        sample_images = ["1.png", "2.png", "3.png", "4.png"]
        for img in sample_images:
            cand = resolve_image_file(f"/logos/{img}")
            if cand and os.path.exists(cand):
                dest = os.path.join(settings.UPLOAD_DIR, img)
                if not os.path.exists(dest):
                    try:
                        shutil.copy2(cand, dest)
                    except Exception:
                        pass

        logger.info("Seeding projects with mandatory employee assignments...")
        now = datetime.datetime.utcnow()

        # Project 1 (Urgent, In Progress)
        p1 = Project(
            title="Titan Mesh Micro-Kernel v4.2",
            description="Core sovereign cloud mesh and encrypted federated data pipelines for high-reliability low-latency edge deployment.",
            company_id=company_map["AVD-TECH"].id,
            creator_id=user_map["director"].id,
            lead_id=user_map["manager"].id,
            status="In Progress",
            priority="Urgent",
            progress=0.0,
            start_date=now - datetime.timedelta(days=15),
            deadline=now + datetime.timedelta(days=20),
            is_draft=False
        )
        db.add(p1)
        db.flush()

        db.add(ProjectEmployeeAssignment(project_id=p1.id, user_id=user_map["manager"].id))
        db.add(ProjectEmployeeAssignment(project_id=p1.id, user_id=user_map["employee"].id))

        # Project 2 (High, Review)
        p2 = Project(
            title="Zero-Trust Perimeter Auditing Suite",
            description="Cryptographic handshake verification and hardware enclave key attestation across infrastructure nodes.",
            company_id=company_map["AVD-TECH"].id,
            creator_id=user_map["pm"].id,
            lead_id=user_map["employee"].id,
            status="Review",
            status_override="Review",
            priority="High",
            progress=0.0,
            start_date=now - datetime.timedelta(days=25),
            deadline=now + datetime.timedelta(days=5),
            is_draft=False
        )
        db.add(p2)
        db.flush()
        db.add(ProjectEmployeeAssignment(project_id=p2.id, user_id=user_map["employee"].id))

        # Project 3 (Medium, Closed)
        p3 = Project(
            title="Syndicated Debt Facility IX Gateway",
            description="Automated institutional tranche settlement and collateral verification portal for capital partners.",
            company_id=company_map["AVD-CAP"].id,
            creator_id=user_map["director"].id,
            lead_id=user_map["claire"].id,
            status="Closed",
            priority="Medium",
            progress=100.0,
            start_date=now - datetime.timedelta(days=60),
            deadline=now - datetime.timedelta(days=10),
            is_draft=False
        )
        db.add(p3)
        db.flush()
        db.add(ProjectEmployeeAssignment(project_id=p3.id, user_id=user_map["claire"].id))

        # Project 4 (Low, On Hold)
        p4 = Project(
            title="Crispr Cas-13 Patent Protection Ledger",
            description="Genomic IP sequencing verification with distributed ledger immutability and regulatory compliance trails.",
            company_id=company_map["AVD-BIO"].id,
            creator_id=user_map["developer"].id,
            lead_id=user_map["employee"].id,
            status="On Hold",
            status_override="On Hold",
            priority="Low",
            progress=0.0,
            start_date=now - datetime.timedelta(days=30),
            deadline=now + datetime.timedelta(days=45),
            is_draft=False
        )
        db.add(p4)
        db.flush()
        db.add(ProjectEmployeeAssignment(project_id=p4.id, user_id=user_map["employee"].id))

        # Project 5 (Saved Draft for testing Section 11)
        p5_draft = Project(
            title="NextGen Hardware Enclave Prototype (Draft)",
            description="Confidential unreleased blueprint for ASIC cryptographic accelerators.",
            company_id=company_map["AVD-TECH"].id,
            creator_id=user_map["director"].id,
            lead_id=user_map["manager"].id,
            status="Not Started",
            priority="High",
            progress=0.0,
            start_date=now,
            deadline=now + datetime.timedelta(days=90),
            is_draft=True # DRAFT!
        )
        db.add(p5_draft)
        db.flush()
        db.add(ProjectEmployeeAssignment(project_id=p5_draft.id, user_id=user_map["manager"].id))

        db.commit()

        logger.info("Seeding modules with updates & image attachments...")
        # Project 1 Modules (Total 5 modules for Section 17 testing!)
        # 1 Closed, 4 In Progress / Review / Not Started -> Progress = 1/5 * 100 = 20.0% !
        m1 = Module(
            project_id=p1.id,
            name="Design Distributed Mesh Protocol",
            description="Initial architectural design specifications for peer-to-peer gossip protocol and consensus engine.",
            status="Closed",
            priority="High",
            progress=100.0,
            start_date=now - datetime.timedelta(days=14),
            deadline=now - datetime.timedelta(days=7),
            assigned_to_id=user_map["manager"].id,
            sort_order=1
        )
        m2 = Module(
            project_id=p1.id,
            name="Implement Kernel State Transition Trees",
            description="Rust-based deterministic state machine with verifiable bloom filters and merkle proofs.",
            status="In Progress",
            priority="Urgent",
            progress=70.0,
            start_date=now - datetime.timedelta(days=6),
            deadline=now + datetime.timedelta(days=8),
            assigned_to_id=user_map["employee"].id,
            sort_order=2
        )
        m3 = Module(
            project_id=p1.id,
            name="Deploy HSM Secure Enclave Telemetry",
            description="Hardware security module key management integration and automated board auditing report generation.",
            status="Review",
            priority="Medium",
            progress=50.0,
            start_date=now + datetime.timedelta(days=1),
            deadline=now + datetime.timedelta(days=12),
            assigned_to_id=user_map["employee"].id,
            sort_order=3
        )
        m4 = Module(
            project_id=p1.id,
            name="Benchmarking & Network Fuzz Testing",
            description="Stress test cluster under simulated 40Gbps ingress flood with eBPF metrics.",
            status="On Hold",
            priority="High",
            progress=30.0,
            start_date=now + datetime.timedelta(days=5),
            deadline=now + datetime.timedelta(days=18),
            assigned_to_id=user_map["employee"].id,
            sort_order=4
        )
        m5 = Module(
            project_id=p1.id,
            name="Security Audit & Compliance Sign-Off",
            description="External auditor sign-off and CVE penetration testing certification.",
            status="Not Started",
            priority="Low",
            progress=0.0,
            start_date=now + datetime.timedelta(days=15),
            deadline=now + datetime.timedelta(days=25),
            assigned_to_id=user_map["manager"].id,
            sort_order=5
        )
        db.add_all([m1, m2, m3, m4, m5])
        db.flush()

        # Add updates and attachments for m1 & m2
        u1_1 = Update(module_id=m1.id, user_id=user_map["director"].id, description_text="Protocol draft RFC-8949 compliance verified.", created_at=now - datetime.timedelta(days=14))
        u1_2 = Update(module_id=m1.id, user_id=user_map["manager"].id, description_text="Kyber-768 key exchange latency benchmarked at 1.4ms.", created_at=now - datetime.timedelta(days=10))
        u1_3 = Update(module_id=m1.id, user_id=user_map["manager"].id, description_text="Final Review approved. Primitives verified.", created_at=now - datetime.timedelta(days=7))
        db.add_all([u1_1, u1_2, u1_3])
        db.flush()

        att1 = Attachment(module_id=m1.id, update_id=u1_2.id, file_name="mesh_architecture_diagram.png", file_path="/uploads/1.png", file_size=3184078, file_type="image/png", uploaded_by_id=user_map["manager"].id)
        att2 = Attachment(module_id=m1.id, update_id=u1_3.id, file_name="benchmark_latency_curve.png", file_path="/uploads/2.png", file_size=836542, file_type="image/png", uploaded_by_id=user_map["manager"].id)
        db.add_all([att1, att2])

        u2_1 = Update(module_id=m2.id, user_id=user_map["employee"].id, description_text="Tree structure implemented with 256-bit hash roots.", created_at=now - datetime.timedelta(days=5))
        u2_2 = Update(module_id=m2.id, user_id=user_map["employee"].id, description_text="Resolved race condition on parallel leaf insertion.", created_at=now - datetime.timedelta(days=2))
        db.add_all([u2_1, u2_2])
        db.flush()

        att3 = Attachment(module_id=m2.id, update_id=u2_2.id, file_name="merkle_tree_proof_graph.png", file_path="/uploads/3.png", file_size=1880883, file_type="image/png", uploaded_by_id=user_map["employee"].id)
        att4 = Attachment(module_id=m2.id, update_id=u2_2.id, file_name="parallel_execution_trace.png", file_path="/uploads/4.png", file_size=2232179, file_type="image/png", uploaded_by_id=user_map["employee"].id)
        db.add_all([att3, att4])

        # Gantt dependencies
        dep1 = GanttDependency(predecessor_id=m1.id, successor_id=m2.id, dependency_type="finish_to_start")
        dep2 = GanttDependency(predecessor_id=m2.id, successor_id=m3.id, dependency_type="finish_to_start")
        db.add_all([dep1, dep2])
        db.commit()

        # Calculate progress for all projects
        calculate_and_update_project_progress(p1.id, db)
        calculate_and_update_project_progress(p2.id, db)
        calculate_and_update_project_progress(p3.id, db)
        calculate_and_update_project_progress(p4.id, db)

        logger.info("Seeding sticky notes & mentions...")
        sn1 = StickyNote(
            user_id=user_map["developer"].id,
            title="Architecture Checkpoints",
            content="Ensure Swagger contracts match v4.2 spec before Sprint cut-off. Hardware auth dongles required. @Entire Team",
            color="#F4E9D2",
            tab_order=1
        )
        sn2 = StickyNote(
            user_id=user_map["developer"].id,
            title="Deploy Phase 4 SLA",
            content="Zero packet drops under 40Gbps load. Sarah Lin & Marcus Vance to sign off before release tag.",
            color="#DCE4FA",
            tab_order=2
        )
        db.add_all([sn1, sn2])
        db.flush()

        db.add(StickyNoteMention(sticky_note_id=sn1.id, mentioned_user_id=user_map["manager"].id))
        db.add(StickyNoteMention(sticky_note_id=sn1.id, mentioned_user_id=user_map["employee"].id))
        db.add(StickyNoteMention(sticky_note_id=sn2.id, mentioned_user_id=user_map["pm"].id))

        db.add(Notification(
            user_id=user_map["manager"].id,
            sender_id=user_map["developer"].id,
            title="Mentioned in Note",
            message="Alex Dev mentioned you in note 'Architecture Checkpoints'",
            link="/home",
            type="mention"
        ))
        db.add(Notification(
            user_id=user_map["employee"].id,
            sender_id=user_map["manager"].id,
            title="Module Assignment",
            message="You have been assigned to 'Implement Kernel State Transition Trees'",
            link=f"/projects/{p1.id}",
            type="assignment"
        ))

        db.commit()
        logger.info("Database seeding completed successfully.")

    except Exception as e:
        db.rollback()
        logger.error("Error seeding database: %s", e, exc_info=True)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
