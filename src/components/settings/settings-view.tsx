"use client";

/**
 * Settings — Google Sheets sync configuration (the ONLY place workbook
 * coordinates are entered; ARCHITECTURE.md example mapping is the default)
 * plus the account card. PUT is validated again server-side.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/components/timeline/api";
import type { CategoryDTO } from "@/lib/types";

const COLUMN_PATTERN = /^[A-Z]{1,2}$/;

const CATEGORY_KEYS = [
  "website_management",
  "cyber_security",
  "technology_innovation",
  "infrastructure_management",
  "research",
  "meeting",
  "training",
  "other_tasks",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

const FALLBACK_CATEGORY_NAMES: Record<CategoryKey, string> = {
  website_management: "Website Management",
  cyber_security: "Cyber Security",
  technology_innovation: "Technology Innovation",
  infrastructure_management: "Infrastructure Management",
  research: "Research",
  meeting: "Meeting",
  training: "Training",
  other_tasks: "Other Tasks",
};

/** ARCHITECTURE.md example mapping — prefilled, never hard-coded elsewhere. */
const DEFAULT_MAPPING: SheetMappingForm = {
  dateColumn: "A",
  clockInColumn: "B",
  breakStartColumn: "C",
  breakEndColumn: "D",
  clockOutColumn: "E",
  dailyTotalColumn: "F",
  workTotalColumn: "G",
  categories: {
    website_management: "EL",
    cyber_security: "EN",
    technology_innovation: "EP",
    infrastructure_management: "ER",
    research: "FL",
    meeting: "FN",
    training: "FP",
    other_tasks: "FR",
  },
};

interface SheetMappingForm {
  dateColumn: string;
  clockInColumn: string;
  breakStartColumn: string;
  breakEndColumn: string;
  clockOutColumn: string;
  dailyTotalColumn: string;
  workTotalColumn: string;
  categories: Record<CategoryKey, string>;
}

interface SyncConfigForm {
  spreadsheetId: string;
  worksheetName: string;
  mapping: SheetMappingForm;
  timezone: string;
}

interface SyncConfigResponse {
  spreadsheetId: string | null;
  worksheetName: string | null;
  mapping: Partial<SheetMappingForm> | null;
  timezone: string | null;
  headerRow?: number;
  notesColumn?: string;
}

interface SettingsViewProps {
  email: string | null;
  userTimezone: string;
}

const WORKSHEET_COLUMNS: { key: keyof SheetMappingForm; label: string }[] = [
  { key: "dateColumn", label: "Date" },
  { key: "clockInColumn", label: "Clock in" },
  { key: "breakStartColumn", label: "Break start" },
  { key: "breakEndColumn", label: "Break end" },
  { key: "clockOutColumn", label: "Clock out" },
  { key: "dailyTotalColumn", label: "Daily total" },
  { key: "workTotalColumn", label: "Work total" },
];

function ColumnInput({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        className="h-11 w-20 text-center font-mono uppercase"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        maxLength={2}
        aria-invalid={invalid}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export function SettingsView({ email, userTimezone }: SettingsViewProps) {
  const [form, setForm] = useState<SyncConfigForm>({
    spreadsheetId: "",
    worksheetName: "",
    mapping: DEFAULT_MAPPING,
    timezone: userTimezone || "Asia/Jakarta",
  });
  const [categoryNames, setCategoryNames] = useState<
    Record<CategoryKey, string>
  >(FALLBACK_CATEGORY_NAMES);
  const [headerRow, setHeaderRow] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [config, categories] = await Promise.all([
          apiFetch<SyncConfigResponse | null>("/api/sync-config"),
          apiFetch<CategoryDTO[]>("/api/categories").catch(() => []),
        ]);
        if (cancelled) return;
        if (categories.length > 0) {
          const names = { ...FALLBACK_CATEGORY_NAMES };
          for (const category of categories) {
            if (category.key in names) {
              names[category.key as CategoryKey] = category.name;
            }
          }
          setCategoryNames(names);
        }
        if (config) {
          setForm({
            spreadsheetId: config.spreadsheetId ?? "",
            worksheetName: config.worksheetName ?? "",
            mapping: {
              ...DEFAULT_MAPPING,
              ...config.mapping,
              categories: {
                ...DEFAULT_MAPPING.categories,
                ...(config.mapping?.categories ?? {}),
              },
            },
            timezone: config.timezone ?? userTimezone ?? "Asia/Jakarta",
          });
          setHeaderRow(config.headerRow);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not load your sync settings.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userTimezone]);

  function setColumn(key: keyof SheetMappingForm, value: string) {
    setForm((prev) => ({
      ...prev,
      mapping: { ...prev.mapping, [key]: value },
    }));
  }

  function setCategoryColumn(key: CategoryKey, value: string) {
    setForm((prev) => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        categories: { ...prev.mapping.categories, [key]: value },
      },
    }));
  }

  function validate(): string[] {
    const errors: string[] = [];
    if (form.spreadsheetId.trim().length < 5) {
      errors.push("Spreadsheet ID must be at least 5 characters.");
    }
    if (form.worksheetName.trim().length === 0) {
      errors.push("Worksheet name is required.");
    }
    if (form.timezone.trim().length === 0) {
      errors.push("Timezone is required.");
    }
    for (const column of WORKSHEET_COLUMNS) {
      if (!COLUMN_PATTERN.test(form.mapping[column.key] as string)) {
        errors.push(
          `“${column.label}” column must be a column letter (A–ZZ).`,
        );
      }
    }
    for (const key of CATEGORY_KEYS) {
      if (!COLUMN_PATTERN.test(form.mapping.categories[key])) {
        errors.push(
          `“${categoryNames[key]}” column must be a column letter (A–ZZ).`,
        );
      }
    }
    return errors;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (errors.length > 0) {
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/sync-config", {
        method: "PUT",
        body: JSON.stringify({
          spreadsheetId: form.spreadsheetId.trim(),
          worksheetName: form.worksheetName.trim(),
          timezone: form.timezone.trim(),
          mapping: {
            dateColumn: form.mapping.dateColumn,
            clockInColumn: form.mapping.clockInColumn,
            breakStartColumn: form.mapping.breakStartColumn,
            breakEndColumn: form.mapping.breakEndColumn,
            clockOutColumn: form.mapping.clockOutColumn,
            dailyTotalColumn: form.mapping.dailyTotalColumn,
            workTotalColumn: form.mapping.workTotalColumn,
            categories: {
              website_management: form.mapping.categories.website_management,
              cyber_security: form.mapping.categories.cyber_security,
              technology_innovation:
                form.mapping.categories.technology_innovation,
              infrastructure_management:
                form.mapping.categories.infrastructure_management,
              research: form.mapping.categories.research,
              meeting: form.mapping.categories.meeting,
              training: form.mapping.categories.training,
              other_tasks: form.mapping.categories.other_tasks,
            },
            ...(headerRow !== undefined ? { headerRow } : {}),
          },
        }),
      });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
      </header>

      <Separator className="my-6" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Google Sheets</CardTitle>
            <CardDescription>
              Where the reviewed day lands. Column letters map TETRA fields to
              worksheet cells — verify them against the actual workbook before
              the first sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-3" aria-label="Loading settings">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-lg bg-muted"
                    aria-hidden
                  />
                ))}
              </div>
            ) : (
              <form onSubmit={handleSave} className="grid gap-6">
                {loadError && (
                  <p role="alert" className="text-sm text-destructive">
                    {loadError} — defaults shown below.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="spreadsheet-id">Spreadsheet ID</Label>
                    <Input
                      id="spreadsheet-id"
                      className="h-11 font-mono"
                      value={form.spreadsheetId}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          spreadsheetId: e.target.value,
                        }))
                      }
                      placeholder="1AbC…"
                      autoComplete="off"
                      spellCheck={false}
                      data-testid="settings-spreadsheet-id"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="worksheet-name">Worksheet name</Label>
                    <Input
                      id="worksheet-name"
                      className="h-11"
                      value={form.worksheetName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          worksheetName: e.target.value,
                        }))
                      }
                      placeholder="Sheet1"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-medium">
                    Worksheet columns
                  </legend>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {WORKSHEET_COLUMNS.map((column) => (
                      <ColumnInput
                        key={column.key}
                        id={`col-${column.key}`}
                        label={column.label}
                        value={form.mapping[column.key] as string}
                        onChange={(value) => setColumn(column.key, value)}
                        invalid={
                          !COLUMN_PATTERN.test(
                            form.mapping[column.key] as string,
                          )
                        }
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-medium">
                    Category columns
                  </legend>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {CATEGORY_KEYS.map((key) => (
                      <ColumnInput
                        key={key}
                        id={`cat-${key}`}
                        label={categoryNames[key]}
                        value={form.mapping.categories[key]}
                        onChange={(value) => setCategoryColumn(key, value)}
                        invalid={
                          !COLUMN_PATTERN.test(form.mapping.categories[key])
                        }
                      />
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-2 sm:max-w-xs">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    className="h-11"
                    value={form.timezone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        timezone: e.target.value,
                      }))
                    }
                    placeholder="Asia/Jakarta"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    IANA name, e.g. Asia/Jakarta.
                  </p>
                </div>

                {fieldErrors.length > 0 && (
                  <ul role="alert" className="grid gap-1 text-sm text-destructive">
                    {fieldErrors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}

                <div>
                  <Button
                    type="submit"
                    className="h-11 px-5"
                    disabled={saving}
                    data-testid="settings-save"
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{email ?? "Not signed in"}</p>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-muted-foreground">Timezone</p>
              <p className="font-medium">{userTimezone}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
