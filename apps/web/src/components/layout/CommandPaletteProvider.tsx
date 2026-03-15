"use client";

import { CommandPalette, useCommandPalette } from "@/components/ui/CommandPalette";

export function CommandPaletteProvider() {
  const { isOpen, close } = useCommandPalette();

  return <CommandPalette isOpen={isOpen} onClose={close} />;
}
