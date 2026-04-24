import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

interface TabBarVisibilityContextValue {
  translateY: Animated.Value;
  fabScale: Animated.Value;
  fabOpacity: Animated.Value;
  fabPointerEvents: "box-none" | "none";
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Call when the Feeds tab becomes active so the FAB/tab bar are not stuck hidden. */
  resetScrollChrome: () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  translateY: new Animated.Value(0),
  fabScale: new Animated.Value(1),
  fabOpacity: new Animated.Value(1),
  fabPointerEvents: "box-none",
  onScroll: () => {},
  resetScrollChrome: () => {},
});

const HIDE_THRESHOLD = 8;

const tabBarSpring = {
  useNativeDriver: true as const,
  tension: 80,
  friction: 12,
};

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const fabOpacity = useRef(new Animated.Value(1)).current;
  const lastOffsetY = useRef(0);
  const isHidden = useRef(false);
  const [fabPointerEvents, setFabPointerEvents] = useState<"box-none" | "none">("box-none");

  const resetScrollChrome = useCallback(() => {
    isHidden.current = false;
    lastOffsetY.current = -1;
    setFabPointerEvents("box-none");
    translateY.setValue(0);
    fabScale.setValue(1);
    fabOpacity.setValue(1);
  }, [translateY, fabScale, fabOpacity]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      if (lastOffsetY.current < 0) {
        lastOffsetY.current = currentY;
        return;
      }
      const diff = currentY - lastOffsetY.current;
      lastOffsetY.current = currentY;

      if (currentY <= 0) {
        if (isHidden.current) {
          isHidden.current = false;
          setFabPointerEvents("box-none");
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, ...tabBarSpring }),
            Animated.spring(fabScale, { toValue: 1, ...tabBarSpring }),
            Animated.timing(fabOpacity, {
              toValue: 1,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start();
        }
        return;
      }

      if (diff > HIDE_THRESHOLD && !isHidden.current) {
        isHidden.current = true;
        setFabPointerEvents("none");
        Animated.parallel([
          Animated.spring(translateY, { toValue: 100, ...tabBarSpring }),
          Animated.timing(fabScale, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fabOpacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      } else if (diff < -HIDE_THRESHOLD && isHidden.current) {
        isHidden.current = false;
        setFabPointerEvents("box-none");
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, ...tabBarSpring }),
          Animated.spring(fabScale, { toValue: 1, ...tabBarSpring }),
          Animated.timing(fabOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    [translateY, fabScale, fabOpacity],
  );

  return (
    <TabBarVisibilityContext.Provider
      value={{ translateY, fabScale, fabOpacity, fabPointerEvents, onScroll, resetScrollChrome }}
    >
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}
