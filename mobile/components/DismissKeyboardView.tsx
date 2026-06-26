import React from "react";
import { Keyboard, TouchableWithoutFeedback, View, type ViewProps } from "react-native";

type Props = ViewProps & {
  children: React.ReactNode;
};

/** Tap outside focused inputs to dismiss the keyboard. Child inputs and buttons keep focus/press behavior. */
export function DismissKeyboardView({ children, style, ...props }: Props) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={style} {...props}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
}
