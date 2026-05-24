declare module "react-native-collapsible-tab-view/src/hooks" {
  import type { SharedValue } from "react-native-reanimated";

  export function useTabsContext(): {
    refMap: Record<string, unknown>;
    focusedTab: SharedValue<string>;
    headerScrollDistance: SharedValue<number>;
  };

  export function useScroller(): (
    ref: unknown,
    x: number,
    y: number,
    animated: boolean,
    debugKey?: string,
  ) => void;

  export function useCurrentTabScrollY(): SharedValue<number>;
}
