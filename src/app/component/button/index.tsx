import React from "react";
import styles from "./button.module.css";

export default function Button(props: React.ComponentProps<"button">) {
  return (
    <button {...props} className={styles.btn__main}>
      Button
    </button>
  );
}
