import dynamic from "next/dynamic";
import * as React from "react";

// Define the type of the LottiePlayer
type LottiePlayer = any; // Change 'any' to the correct type if you have access to the actual type

const loadLottie: () => Promise<{ default: LottiePlayer }> = () =>
  import("lottie-web").then((module) => ({ default: module.default }));

// Dynamically load LottieComponent
const LottieComponent = dynamic(() => loadLottie(), { ssr: false });

export type LoadingState = "loading" | "completed" | "error";

interface IProps {
  currentState: LoadingState;
  className?: string;
}

export const LoadingAnimation: React.FC<IProps> = ({
  currentState,
  className,
}) => {
  const container = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const animations: Record<LoadingState, string> = {
      loading: "/assets/loading-animation.json",
      completed: "/assets/check-animation.json",
      error: "/assets/cross-animation.json",
    };

    if (!container.current) return;
    if (typeof window === "undefined") return;

    // Load the animation when the component mounts
    const loadAnimation = async () => {
      const lottieModule = await loadLottie();
      const animationPlayer = lottieModule.default.loadAnimation({
        container: container.current,
        renderer: "svg",
        autoplay: true,
        loop: currentState === "loading",
        path: animations[currentState],
      });

      return animationPlayer;
    };

    loadAnimation();

    // Cleanup animation when component unmounts
    return () => {
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [container, currentState]);

  if (className) {
    return <div ref={container} className={className} />;
  }

  return <div ref={container} />;
};
