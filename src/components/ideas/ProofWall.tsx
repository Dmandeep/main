"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Link2, Image as ImageIcon, GitBranch, FileText, CheckCircle2, AlertCircle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/ToastSystem";
import { Avatar } from "@/components/ui/avatar";
import { cn, errorMessage } from "@/lib/utils";
import type { ProofItem } from "@/types/api";

const proofSchema = z.object({
  title: z.string().min(5, "Title is too short").max(100),
  url: z.string().url("Must be a valid URL"),
  type: z.enum(["link", "image", "github", "document"]),
  description: z.string().max(300).optional(),
});

type ProofFormValues = z.infer<typeof proofSchema>;

interface ProofWallProps {
  ideaId: string;
  proofs: ProofItem[];
  isCollaborator: boolean;
  onProofSubmitted?: (proof: ProofItem) => void;
}

const ICONS = {
  link: Link2,
  image: ImageIcon,
  github: GitBranch,
  document: FileText,
};

const STATUS_COLORS = {
  pending: "text-brand-warning bg-brand-warning/10 border-brand-warning/20",
  approved: "text-brand-success bg-brand-success/10 border-brand-success/20",
  rejected: "text-brand-danger bg-brand-danger/10 border-brand-danger/20",
};

export function ProofWall({ ideaId, proofs, isCollaborator, onProofSubmitted }: ProofWallProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProofFormValues>({
    resolver: zodResolver(proofSchema),
    defaultValues: { type: "link", title: "", url: "", description: "" },
  });

  const onSubmit = async (data: ProofFormValues) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success("Proof Submitted", "Your work has been submitted for review.");
      setIsModalOpen(false);
      reset();
      onProofSubmitted?.(result.data);
    } catch (error) {
      toast.error("Submission Failed", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-rule pb-4">
        <div>
          <h3 className="text-xl font-display font-bold text-text-primary">Proof of Work</h3>
          <p className="text-sm text-text-secondary">Verifiable artifacts of the build process.</p>
        </div>
        {isCollaborator && (
          <Button onClick={() => setIsModalOpen(true)} variant="secondary" className="gap-2">
            <Plus className="w-4 h-4" /> Add Proof
          </Button>
        )}
      </div>

      {proofs.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center border border-dashed border-rule rounded-[var(--radius-lg)] bg-surface-overlay/50">
          <FileText className="w-12 h-12 text-text-muted mb-3" />
          <p className="text-text-primary font-bold">No proof submitted yet.</p>
          <p className="text-text-secondary text-sm">Collaborators can submit links, images, or code.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {proofs.map((proof) => {
              const Icon = ICONS[proof.type as keyof typeof ICONS] || Link2;
              return (
                <motion.div
                  key={proof._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-[var(--radius-lg)] bg-surface-raised border border-rule hover:border-ink-300 transition-colors group flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-surface-overlay rounded-md text-brand-primary group-hover:text-brand-accent transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <a href={proof.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-text-primary hover:underline line-clamp-1">
                          {proof.title}
                        </a>
                        <span className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(proof.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border", STATUS_COLORS[proof.status as keyof typeof STATUS_COLORS])}>
                      {proof.status === "approved" ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> :
                       proof.status === "rejected" ? <AlertCircle className="w-3 h-3 inline mr-1" /> :
                       <Clock className="w-3 h-3 inline mr-1" />}
                      {proof.status}
                    </div>
                  </div>
                  
                  {proof.description && (
                    <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                      {proof.description}
                    </p>
                  )}

                  {/* Gamification Score Display */}
                  {(proof as any).overallScore != null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/60 shadow-sm mb-4 self-start">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">AI Score</span>
                      <span className="text-sm font-display font-black text-amber-600">{(proof as any).overallScore}/100</span>
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-rule flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={proof.submitter.name} size="sm" />
                      <span className="text-xs text-text-secondary font-medium">{proof.submitter.name}</span>
                    </div>
                    {proof.pointsAwarded > 0 && (
                      <span className="text-xs font-bold text-brand-secondary">+{proof.pointsAwarded} pts</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Proof of Work">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-text-primary">Title</label>
            <input 
              {...register("title")}
              className="w-full mt-1 bg-surface-overlay border border-rule rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none"
              placeholder="e.g. Initial UI Commit"
            />
            {errors.title && <p className="text-brand-danger text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-text-primary">Type</label>
              <select 
                {...register("type")}
                className="w-full mt-1 bg-surface-overlay border border-rule rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none"
              >
                <option value="link">Link</option>
                <option value="github">GitHub PR/Commit</option>
                <option value="image">Screenshot/Image</option>
                <option value="document">Document</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-text-primary">URL</label>
              <input 
                {...register("url")}
                className="w-full mt-1 bg-surface-overlay border border-rule rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none"
                placeholder="https://..."
              />
              {errors.url && <p className="text-brand-danger text-xs mt-1">{errors.url.message}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-text-primary">Description (Optional)</label>
            <textarea 
              {...register("description")}
              rows={3}
              className="w-full mt-1 bg-surface-overlay border border-rule rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none resize-none"
              placeholder="What does this proof demonstrate?"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-rule">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? "Submitting..." : "Submit Proof"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
