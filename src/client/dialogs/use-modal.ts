
import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";

/**
 * Native <dialog> opened modally with a GSAP entrance. `close()` plays the
 * exit before calling `onClose`, and Escape is routed through the same path.
 */
export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    const panel = dialog.firstElementChild;
    gsap.fromTo(
      dialog,
      { "--backdrop": 0 },
      { "--backdrop": 1, duration: 0.3 }
    );
    if (panel) {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, scale: 0.97, y: 14 },
        { autoAlpha: 1, duration: 0.45, ease: "expo.out", scale: 1, y: 0 }
      );
    }
  }, []);

  const close = useCallback(() => {
    const dialog = ref.current;
    if (!dialog || closing.current) {
      return;
    }
    closing.current = true;
    const panel = dialog.firstElementChild;
    gsap.to(dialog, { "--backdrop": 0, duration: 0.2 });
    gsap.to(panel, {
      autoAlpha: 0,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        dialog.close();
        onClose();
      },
      y: 8,
    });
  }, [onClose]);

  const dialogProps = {
    onCancel: (e: React.SyntheticEvent) => {
      e.preventDefault();
      close();
    },
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    ref,
  };

  return { close, dialogProps };
}
