import React from "react";
import { StyleSheet, Text, View, type TextProps, type TextStyle } from "react-native";
import { bodyParagraphs, doubleSpacedLineHeight, normalizeBodyText } from "@/lib/formattedText";

type Props = Omit<TextProps, "children"> & {
  text: string;
  style?: TextStyle | TextStyle[];
  fontSize?: number;
  lineHeight?: number;
  paragraphGap?: number;
};

export function FormattedBodyText({
  text,
  style,
  fontSize,
  lineHeight,
  paragraphGap,
  numberOfLines,
  ...rest
}: Props) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fs = fontSize ?? (typeof flat?.fontSize === "number" ? flat.fontSize : 15);
  const lh = lineHeight ?? doubleSpacedLineHeight(fs);
  const gap = paragraphGap ?? Math.round(lh * 0.4);
  const normalized = normalizeBodyText(text).trim();

  if (!normalized) return null;

  const paragraphs = bodyParagraphs(normalized);
  const baseStyle: TextStyle = { fontSize: fs, lineHeight: lh };

  if (numberOfLines != null || paragraphs.length <= 1) {
    return (
      <Text {...rest} style={[baseStyle, style]} numberOfLines={numberOfLines}>
        {normalized}
      </Text>
    );
  }

  return (
    <View>
      {paragraphs.map((paragraph, index) => (
        <Text
          key={`${index}-${paragraph.slice(0, 24)}`}
          {...rest}
          style={[baseStyle, style, index > 0 ? { marginTop: gap } : null]}
        >
          {paragraph}
        </Text>
      ))}
    </View>
  );
}
