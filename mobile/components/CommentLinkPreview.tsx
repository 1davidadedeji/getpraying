import React from "react";
import { type StyleProp, type TextStyle } from "react-native";

import { FormattedBodyText } from "@/components/FormattedBodyText";
import { OutboundOgLinkCard } from "@/components/OutboundOgLinkCard";
import { useOpenGraphPreviewState } from "@/hooks/useOpenGraphPreviewState";

type Props = {
  content: string;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Comment body + optional Open Graph link card; when the card shows,
 * the raw https URL is omitted from the text for cleaner layout.
 */
export function CommentRichBodyWithOgLink({ content, textStyle }: Props) {
  const og = useOpenGraphPreviewState(content);

  return (
    <>
      {og.displayTextWithoutUrl.trim().length > 0 ? (
        <FormattedBodyText text={og.displayTextWithoutUrl} style={textStyle as TextStyle | undefined} />
      ) : null}
      {og.showLinkPreview ? (
        <OutboundOgLinkCard
          imageUrl={og.preview?.imageUrl}
          previewTitle={og.previewTitle}
          previewHost={og.previewHost}
          variant="detail"
          onPress={() => void og.openOutboundLink()}
        />
      ) : null}
    </>
  );
}
