import React, { createContext, useCallback, useContext, useRef } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

interface TabBarVisibilityContextValue {
  translateY: Animated.Value;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  translateY: new Animated.Value(0),
  onScroll: () => {},
});

const HIDE_THRESHOLD = 8;

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffsetY = useRef(0);
  const isHidden = useRef(false);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - lastOffsetY.current;
      lastOffsetY.current = currentY;

      if (currentY <= 0) {
        if (isHidden.current) {
          isHidden.current = false;
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
        return;
      }

      if (diff > HIDE_THRESHOLD && !isHidden.current) {
        isHidden.current = true;
        Animated.spring(translateY, {
          toValue: 100,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      } else if (diff < -HIDE_THRESHOLD && isHidden.current) {
        isHidden.current = false;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      }
    },
    [translateY],
  );

  return (
    <TabBarVisibilityContext.Provider value={{ translateY, onScroll }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}
