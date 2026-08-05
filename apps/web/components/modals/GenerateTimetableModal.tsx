'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Modal } from '@/components/modals/Modal';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';
import { cn } from '@/lib/utils';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';
import { usePeriodTemplates } from '@/services/api/requests/timetable-config';
import {
  type PreflightIssue,
  extractPreflightIssues,
  useGenerateTimetable,
  usePreflightTimetable,
} from '@/services/api/requests/timetables';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, OctagonX } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const generateSchema = z.object({
  academicTermId: z.string().min(1, 'Pick an academic term.'),
  periodTemplateId: z.string().min(1, 'Pick a period template.'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(100, 'Name must be 100 characters or fewer.'),
});

type GenerateValues = z.infer<typeof generateSchema>;

export interface GenerateTimetableDefaults {
  academicTermId?: string;
  periodTemplateId?: string;
  name?: string;
}

interface GenerateTimetableModalProps {
  generateDefaults: GenerateTimetableDefaults | null;
}

export function GenerateTimetableModal({
  generateDefaults,
}: GenerateTimetableModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();

  const { data: terms, isLoading: isLoadingTerms } = useAcademicTerms();
  const { data: templates, isLoading: isLoadingTemplates } =
    usePeriodTemplates();

  const { mutateAsync: preflight, isPending: isPreflighting } =
    usePreflightTimetable();
  const { mutateAsync: generate, isPending: isGenerating } =
    useGenerateTimetable();
  const isBusy = isPreflighting || isGenerating;

  const [issues, setIssues] = useState<PreflightIssue[]>([]);
  // Warnings block the first click; the second click on the same term +
  // template combination proceeds ("Generate anyway").
  const [acknowledgedKey, setAcknowledgedKey] = useState<string | null>(null);

  const activeTerm = useMemo(() => terms?.find((t) => t.isActive), [terms]);

  const termOptions = useMemo(
    () => (terms ?? []).map((t) => ({ value: t.id, label: t.name })),
    [terms],
  );
  const templateOptions = useMemo(
    () =>
      (templates ?? []).map((t) => ({
        value: t.id,
        label: t.name,
        description: `${t.slots.filter((s) => s.kind === 'PERIOD').length} periods · ${t.workingDays.length} days`,
      })),
    [templates],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      academicTermId: generateDefaults?.academicTermId ?? activeTerm?.id ?? '',
      periodTemplateId: generateDefaults?.periodTemplateId ?? '',
      name: generateDefaults?.name ?? '',
    },
  });

  const hasErrors = issues.some((issue) => issue.severity === 'ERROR');
  const needsAck = !hasErrors && issues.length > 0;

  const onSubmit = async (values: GenerateValues) => {
    const ackKey = `${values.academicTermId}|${values.periodTemplateId}`;
    try {
      const { issues: preflightIssues } = await preflight({
        academicTermId: values.academicTermId,
        periodTemplateId: values.periodTemplateId,
      });
      const errorIssues = preflightIssues.filter(
        (issue) => issue.severity === 'ERROR',
      );
      const warningIssues = preflightIssues.filter(
        (issue) => issue.severity === 'WARNING',
      );

      if (errorIssues.length > 0) {
        setIssues(preflightIssues);
        setAcknowledgedKey(null);
        return;
      }
      if (warningIssues.length > 0 && acknowledgedKey !== ackKey) {
        setIssues(preflightIssues);
        setAcknowledgedKey(ackKey);
        return;
      }

      await generate({
        academicTermId: values.academicTermId,
        periodTemplateId: values.periodTemplateId,
        name: values.name,
      });
      toast.success('Generation started — the draft will appear shortly.');
      hideModal();
    } catch (err) {
      const structured = extractPreflightIssues(err);
      if (structured.length > 0) {
        setIssues(structured);
        setAcknowledgedKey(null);
      } else {
        showError(err);
      }
    }
  };

  const noTemplates = !isLoadingTemplates && (templates?.length ?? 0) === 0;

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title="Generate Timetable"
      description="The solver builds a conflict-free draft from your period template, allocations, and teacher constraints."
      size="md"
      primaryAction={{
        label: isPreflighting
          ? 'Checking setup...'
          : isGenerating
            ? 'Starting...'
            : needsAck
              ? 'Generate anyway'
              : 'Generate',
        onClick: handleSubmit(onSubmit),
        loading: isBusy,
        disabled: isBusy || noTemplates,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: hideModal,
        disabled: isBusy,
      }}
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-5">
          <Field data-invalid={!!errors.academicTermId}>
            <FieldLabel
              htmlFor="academicTermId"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Academic Term <span className="text-red-500">*</span>
            </FieldLabel>
            <SearchableSelect
              id="academicTermId"
              options={termOptions}
              placeholder="-- Select term --"
              disabled={isBusy || isLoadingTerms}
              {...register('academicTermId')}
            />
            {errors.academicTermId && (
              <FieldError>{errors.academicTermId.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={!!errors.periodTemplateId}>
            <FieldLabel
              htmlFor="periodTemplateId"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Period Template <span className="text-red-500">*</span>
            </FieldLabel>
            <SearchableSelect
              id="periodTemplateId"
              options={templateOptions}
              placeholder="-- Select template --"
              disabled={isBusy || isLoadingTemplates}
              {...register('periodTemplateId')}
            />
            {noTemplates && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                No period templates yet — create one under Timetable Setup →
                Periods first.
              </p>
            )}
            {errors.periodTemplateId && (
              <FieldError>{errors.periodTemplateId.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={!!errors.name}>
            <FieldLabel
              htmlFor="name"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Version Name <span className="text-red-500">*</span>
            </FieldLabel>
            <Input
              id="name"
              {...register('name')}
              disabled={isBusy}
              placeholder="e.g. Term 1 weekly timetable"
              className="h-10 text-sm focus-visible:ring-primary/30"
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>
        </FieldGroup>

        {issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Preflight results
            </p>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
                    issue.severity === 'ERROR'
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                      : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
                  )}
                >
                  {issue.severity === 'ERROR' ? (
                    <OctagonX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
            {hasErrors ? (
              <p className="text-[10px] text-muted-foreground">
                Fix the errors above in Timetable Setup, then try again.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Warnings won&apos;t block generation — click &ldquo;Generate
                anyway&rdquo; to proceed.
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
