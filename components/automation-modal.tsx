"use client";

import { useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SocialPlatform } from "@prisma/client";

type AutomationForm = {
  id?: string;
  name?: string;
  type?: string;
  platform?: SocialPlatform;
  prompt?: string;
  description?: string | null;
  example?: string | null;
};

type AutomationModalProps = {
  automation?: AutomationForm;
  action: (formData: FormData) => Promise<void>;
  deleteAction?: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
};

const automationTypes = [
  { label: "Generate post", value: "Generate post" },
  { label: "Marketing idea", value: "Marketing idea" },
  { label: "Client recap", value: "Client recap" },
];

export function AutomationModal({
  automation,
  action,
  deleteAction,
  children,
}: AutomationModalProps) {
  const [open, setOpen] = useState(false);
  const saveFormId = automation?.id
    ? `automation-${automation.id}-save`
    : "automation-new-save";
  const deleteFormId = automation?.id
    ? `automation-${automation.id}-delete`
    : undefined;

  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Do this...</DialogTitle>
          <DialogDescription>
            Configure how Jump should generate content for you.
          </DialogDescription>
        </DialogHeader>
        <form
          id={saveFormId}
          action={async (formData) => {
            await action(formData);
            close();
          }}
        >
          <div className="grid gap-4 py-4">
            {automation?.id && (
              <input type="hidden" name="automationId" value={automation.id} />
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={automation?.name}
                placeholder="Mid-week LinkedIn recap"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={automation?.type ?? automationTypes[0].value}
                >
                  {automationTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="platform">Platform</Label>
                <select
                  id="platform"
                  name="platform"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={automation?.platform ?? "LINKEDIN"}
                >
                  <option value="LINKEDIN">LinkedIn post</option>
                  <option value="FACEBOOK">Facebook post</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={automation?.description ?? ""}
                placeholder="Drafts a warm recap after every planning check-in."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="example">Example</Label>
              <Textarea
                id="example"
                name="example"
                rows={3}
                defaultValue={automation?.example ?? ""}
                placeholder="Talking with clients about staying calm in choppy markets..."
              />
            </div>
          </div>
        </form>
        {automation?.id && deleteAction && deleteFormId && (
          <form
            id={deleteFormId}
            action={async (formData) => {
              await deleteAction(formData);
              close();
            }}
          >
            <input type="hidden" name="automationId" value={automation.id} />
          </form>
        )}
        <DialogFooter className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form={saveFormId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Save &amp; close
            </Button>
          </div>
          {automation?.id && deleteFormId && (
            <Button variant="destructive" type="submit" form={deleteFormId}>
              Delete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

