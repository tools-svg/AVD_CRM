import React from 'react';
import { useUIConfig } from '../../context/UIConfigContext';

interface EditableUIProps extends React.HTMLAttributes<HTMLElement> {
  id: string;
  defaultText?: string;
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export const EditableUI: React.FC<EditableUIProps> = ({
  id,
  defaultText,
  as: Component = 'span',
  children,
  className = '',
  style = {},
  ...rest
}) => {
  const { directEdits } = useUIConfig();
  const custom = directEdits[id];

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(custom?.fontSize ? { fontSize: custom.fontSize } : {}),
    ...(custom?.fontWeight ? { fontWeight: custom.fontWeight } : {}),
    ...(custom?.textColor ? { color: custom.textColor } : {}),
    ...(custom?.backgroundColor ? { backgroundColor: custom.backgroundColor } : {}),
    ...(custom?.border ? { border: custom.border } : {}),
    ...(custom?.borderRadius ? { borderRadius: custom.borderRadius } : {}),
    ...(custom?.width ? { width: custom.width } : {}),
    ...(custom?.height ? { height: custom.height } : {}),
    ...(custom?.visibility ? { visibility: custom.visibility } : {}),
    ...(custom?.padding ? { padding: custom.padding } : {}),
    ...(custom?.margin ? { margin: custom.margin } : {}),
  };

  const displayText = custom?.text !== undefined ? custom.text : (children !== undefined ? children : defaultText);

  return React.createElement(
    Component,
    {
      ...rest,
      'data-ui-editable': id,
      className,
      style: mergedStyle,
    },
    displayText
  );
};

