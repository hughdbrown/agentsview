type Theme = "light" | "dark";
type ModalType =
  | "commandPalette"
  | "shortcuts"
  | "publish"
  | null;

class UIStore {
  theme: Theme = $state(
    (typeof localStorage !== "undefined"
      ? (localStorage.getItem("theme") as Theme)
      : null) || "light",
  );
  showThinking: boolean = $state(true);
  sortNewestFirst: boolean = $state(true);
  activeModal: ModalType = $state(null);
  selectedOrdinal: number | null = $state(null);
  pendingScrollOrdinal: number | null = $state(null);

  constructor() {
    $effect.root(() => {
      $effect(() => {
        const root = document.documentElement;
        if (this.theme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
        localStorage.setItem("theme", this.theme);
      });
    });
  }

  toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
  }

  toggleThinking() {
    this.showThinking = !this.showThinking;
  }

  toggleSort() {
    this.sortNewestFirst = !this.sortNewestFirst;
  }

  selectOrdinal(ordinal: number) {
    this.selectedOrdinal = ordinal;
  }

  clearSelection() {
    this.selectedOrdinal = null;
  }

  scrollToOrdinal(ordinal: number) {
    this.selectedOrdinal = ordinal;
    this.pendingScrollOrdinal = ordinal;
  }

  closeAll() {
    this.activeModal = null;
  }
}

export const ui = new UIStore();
