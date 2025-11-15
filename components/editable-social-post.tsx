"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { PendingButton } from "@/components/form/pending-button";
import { Badge } from "@/components/ui/badge";
import { SocialPostStatus, SocialPlatform } from "@prisma/client";
import { Trash2 } from "lucide-react";
import Image from "next/image";

type Props = {
  post: {
    id: string;
    content: string;
    platform: SocialPlatform;
    status: SocialPostStatus;
    automation?: {
      name: string;
      type?: string | null;
    } | null;
    postedAt?: Date | null;
    externalPostId?: string | null;
  };
  meetingId: string;
  hasLinkedAccount: boolean;
  onUpdate: (formData: FormData) => Promise<void>;
  onPublish: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
  timezone?: string | null;
};

export function EditableSocialPost({
  post,
  meetingId,
  hasLinkedAccount,
  onUpdate,
  onPublish,
  onDelete,
  timezone,
}: Props) {
  const [content, setContent] = useState(post.content);
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("postId", post.id);
      formData.append("content", content);
      formData.append("meetingId", meetingId);
      await onUpdate(formData);
      setIsEditing(false);
    });
  };

  const platformIcon =
    post.platform === SocialPlatform.LINKEDIN
      ? "/logos/linkedin.svg"
      : "/logos/facebook.svg";

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Image
              src={platformIcon}
              alt={post.platform.toLowerCase()}
              width={16}
              height={16}
            />
            <Badge variant="secondary" className="capitalize">
              {post.platform.toLowerCase()}
            </Badge>
            <Badge
              className={
                post.status === "POSTED"
                  ? "bg-emerald-100 text-emerald-900"
                  : post.status === "FAILED"
                    ? "bg-rose-100 text-rose-900"
                    : "bg-slate-100 text-slate-900"
              }
            >
              {post.status.toLowerCase()}
            </Badge>
          </div>
          {post.automation && (
            <p className="text-xs text-muted-foreground">
              {post.automation.type && `${post.automation.type} • `}
              {post.automation.name}
            </p>
          )}
          {post.postedAt && (
            <p className="text-xs text-muted-foreground">
              Posted{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone ?? undefined,
              }).format(post.postedAt)}
              {post.externalPostId && (
                <>
                  {" "}·{" "}
                  <a
                    href={
                      post.platform === SocialPlatform.LINKEDIN
                        ? `https://www.linkedin.com/feed/update/${post.externalPostId}`
                        : `https://www.facebook.com/${post.externalPostId}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View live
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isPending}
            >
              Edit
            </Button>
            <form
              action={(formData) => {
                if (
                  confirm(
                    "Are you sure you want to delete this post? This action cannot be undone.",
                  )
                ) {
                  startTransition(async () => {
                    await onDelete(formData);
                  });
                }
              }}
            >
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="meetingId" value={meetingId} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="min-h-[120px]"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContent(post.content);
                setIsEditing(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <PendingButton size="sm" onClick={handleSave} disabled={isPending}>
              Save
            </PendingButton>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{post.content}</p>
      )}

      {!isEditing && (
        <div className="mt-4 flex gap-2">
          <CopyButton text={post.content} size="sm" />
          {hasLinkedAccount ? (
            post.status !== "POSTED" && (
              <form
                action={(formData) => {
                  startTransition(async () => {
                    await onPublish(formData);
                  });
                }}
              >
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="meetingId" value={meetingId} />
                <PendingButton
                  size="sm"
                  disabled={isPending}
                  variant={post.status === "FAILED" ? "destructive" : "default"}
                >
                  {post.status === "FAILED" ? "Retry post" : "Post"}
                </PendingButton>
              </form>
            )
          ) : (
            <Button
              size="sm"
              variant="outline"
              asChild
              disabled={isPending}
            >
              <a href="/settings">Connect {post.platform === SocialPlatform.LINKEDIN ? "LinkedIn" : "Facebook"}</a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

