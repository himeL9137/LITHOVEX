import type { HTMLAttributes, DetailedHTMLProps } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "iconify-icon": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          icon?: string;
          class?: string;
          width?: string | number;
          height?: string | number;
          flip?: string;
          rotate?: string | number;
          inline?: boolean;
        },
        HTMLElement
      >;
    }
  }
}
