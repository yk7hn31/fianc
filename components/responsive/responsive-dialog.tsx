"use client";

import * as React from "react";
import { useIsDesktop } from "./use-media-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: React.ReactElement;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger render={trigger} />}
        {/*
          A dialog taller than the window would otherwise centre itself and
          push its submit button off both ends of the screen with no way to
          scroll to it — the same trap the drawer branch below falls into, and
          reachable here on any short laptop window.
        */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        {/*
          The popup caps at `calc(100dvh - 6rem)` and clips whatever does not
          fit, with no scroller anywhere inside it. A form taller than that —
          which the transaction form is on a 600px-tall phone, and every form
          here is on a phone held sideways — simply loses its submit button
          off the bottom edge, unreachable by any gesture. `min-h-0` is what
          lets this flex child shrink below its content so `overflow-y-auto`
          has something to scroll; without it the child keeps its full height
          and overflows the clipped popup exactly as before.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
