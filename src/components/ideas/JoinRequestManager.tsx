"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Users, Check, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/ToastSystem";
import { Avatar } from "@/components/ui/avatar";
import { errorMessage } from "@/lib/utils";
import type { JoinRequestItem } from "@/types/api";

const joinSchema = z.object({
  role: z.string().min(2, "Role must be at least 2 characters").max(50),
  message: z.string().max(300).optional(),
});

type JoinFormValues = z.infer<typeof joinSchema>;

interface JoinRequestManagerProps {
  ideaId: string;
  isOwner: boolean;
  isCollaborator: boolean;
  onUpdate?: () => void;
}

export function JoinRequestManager({ ideaId, isOwner, isCollaborator, onUpdate }: JoinRequestManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const joinRequestsKey = ["join-requests", ideaId];
  const { data: requests = [], isPending: fetchingRequests } = useQuery<JoinRequestItem[]>({
    queryKey: joinRequestsKey,
    enabled: isOwner,
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}/join`);
      if (!res.ok) throw new Error("Failed to load join requests");
      const body = await res.json();
      return body.data ?? [];
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { role: "", message: "" },
  });

  const onSubmitJoin = async (data: JoinFormValues) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success("Request Sent", "Your request to join the team has been sent.");
      setIsModalOpen(false);
      reset();
    } catch (error) {
      toast.error("Failed to Send Request", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRequest = async (requestId: string, status: "approved" | "rejected") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/join`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success(`Request ${status}`, `You have ${status} the join request.`);
      queryClient.setQueryData<JoinRequestItem[]>(joinRequestsKey, (prev) =>
        (prev ?? []).filter((req) => req._id !== requestId)
      );
      if (status === "approved") {
        onUpdate?.(); // Trigger a refresh to show the new collaborator
      }
    } catch (error) {
      toast.error("Error", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (isOwner) {
    if (fetchingRequests || requests.length === 0) return null;

    return (
      <div className="mt-6 border-t border-rule pt-6">
        <h4 className="text-xs font-bold text-brand-warning uppercase tracking-widest mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Pending Requests ({requests.length})
        </h4>
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req._id} className="p-3 rounded-lg bg-surface-raised border border-brand-warning/30 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={req.userId.name} tier={req.userId.rankTier} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-text-primary line-clamp-1">{req.userId.name}</div>
                  <div className="text-xs text-brand-secondary font-bold">Wants to join as: {req.role}</div>
                </div>
              </div>
              {req.message && (
                <p className="text-xs text-text-secondary bg-surface-overlay p-2 rounded-md italic">
                  &ldquo;{req.message}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Button 
                  size="sm" 
                  variant="primary" 
                  className="flex-1 h-8 bg-brand-success hover:bg-brand-success/80 text-ink-900"
                  disabled={loading}
                  onClick={() => handleProcessRequest(req._id, "approved")}
                >
                  <Check className="w-3 h-3 mr-1" /> Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="flex-1 h-8 text-brand-danger hover:bg-brand-danger/10 hover:text-brand-danger"
                  disabled={loading}
                  onClick={() => handleProcessRequest(req._id, "rejected")}
                >
                  <X className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isCollaborator) {
    return null; // Already on the team
  }

  return (
    <div className="mt-6 pt-6 border-t border-rule">
      <Button 
        variant="gradient" 
        className="w-full" 
        onClick={() => setIsModalOpen(true)}
      >
        <Users className="w-4 h-4 mr-2" /> Request to Join Team
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Join the Team">
        <form onSubmit={handleSubmit(onSubmitJoin)} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-text-primary">Your Role</label>
            <input 
              {...register("role")}
              className="w-full mt-1 bg-surface-overlay border border-rule rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none"
              placeholder="e.g. Frontend Developer, Designer"
            />
            {errors.role && <p className="text-brand-danger text-xs mt-1">{errors.role.message}</p>}
          </div>

          <div>
            <label className="text-sm font-bold text-text-primary">Message (Optional)</label>
            <textarea 
              {...register("message")}
              rows={3}
              className="w-full mt-1 bg-surface-overlay border border-rule rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none resize-none"
              placeholder="Why do you want to join? What can you contribute?"
            />
            {errors.message && <p className="text-brand-danger text-xs mt-1">{errors.message.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-rule">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
