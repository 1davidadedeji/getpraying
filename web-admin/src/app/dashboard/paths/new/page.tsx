"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormActions } from "@/components/dashboard/FormActions";
import { FormField } from "@/components/dashboard/FormField";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { inputCls, panelCls } from "@/components/dashboard/form-styles";
import { AdminSelect } from "@/components/ui/AdminSelect";
import { PATH_CATEGORY_OPTIONS } from "@/config/post-categories";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { readApiError } from "@/lib/readApiError";

export default function NewPathPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("anxiety");
  const [tagline, setTagline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!token || !name.trim() || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/admin/prayer-paths"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          tagline: tagline.trim() || null,
        }),
      });
      if (res.ok) {
        const row = await res.json();
        router.push(`/dashboard/paths/${row.id}`);
        return;
      }
      setError(await readApiError(res));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="New path" backHref="/dashboard/paths" backLabel="Category guides" />
      <div className={`${panelCls} p-3 sm:p-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Display name *">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </FormField>
          <AdminSelect label="Category *" value={category} onChange={setCategory}>
            {PATH_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </AdminSelect>
          <FormField label="Tagline" className="sm:col-span-2">
            <input className={inputCls} value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={saving} />
          </FormField>
          <FormField label="Description *" className="sm:col-span-2">
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </FormField>
        </div>
        {error ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p> : null}
        <FormActions
          primaryLabel="Create path"
          primaryLoading={saving}
          primaryDisabled={!name.trim() || !description.trim()}
          onPrimary={() => void save()}
          onCancel={() => router.push("/dashboard/paths")}
        />
      </div>
    </>
  );
}
