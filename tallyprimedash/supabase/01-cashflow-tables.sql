-- 01-cashflow-tables.sql
-- Run this ONLY if your Supabase project is NEW (it does not have the cashflow_reports table yet).
-- If you are re-using the same Supabase project the Lovable app was using, SKIP this file.
-- Copy of the original Lovable migrations, in the original order. Nothing here touches Tally.

-- ---- 0000_cashflow_submissions_and_review.sql
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE, role public.app_role NOT NULL);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
CREATE TABLE public.cashflow_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sheet text NOT NULL CHECK (sheet IN ('oppl','prerana','pppl','mcpl','apex','ra')), employee_id uuid NOT NULL, rows jsonb NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(employee_id, sheet));
GRANT SELECT, INSERT, UPDATE ON public.cashflow_reports TO authenticated;
GRANT ALL ON public.cashflow_reports TO service_role;
ALTER TABLE public.cashflow_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employee reads own and admin reads all reports" ON public.cashflow_reports FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Employee creates own report" ON public.cashflow_reports FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid() AND NOT public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin updates report" ON public.cashflow_reports FOR UPDATE TO authenticated USING (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.cashflow_feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES public.cashflow_reports(id) ON DELETE CASCADE, employee_id uuid NOT NULL, sheet text NOT NULL, row_id text, field text, message text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz);
GRANT SELECT, UPDATE ON public.cashflow_feedback TO authenticated;
GRANT INSERT ON public.cashflow_feedback TO authenticated;
GRANT ALL ON public.cashflow_feedback TO service_role;
ALTER TABLE public.cashflow_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employee and admin read feedback" ON public.cashflow_feedback FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin creates feedback" ON public.cashflow_feedback FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Employee resolves own feedback" ON public.cashflow_feedback FOR UPDATE TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
CREATE INDEX cashflow_feedback_report_idx ON public.cashflow_feedback(report_id, resolved_at);

-- ---- 0001_cashflow_approvals.sql
CREATE TABLE public.cashflow_approvals (report_id uuid PRIMARY KEY REFERENCES public.cashflow_reports(id) ON DELETE CASCADE, employee_id uuid NOT NULL, submitted_at timestamptz NOT NULL, approved_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.cashflow_approvals TO authenticated;
GRANT INSERT, UPDATE ON public.cashflow_approvals TO authenticated;
GRANT ALL ON public.cashflow_approvals TO service_role;
ALTER TABLE public.cashflow_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employee reads own approval and admin reads all" ON public.cashflow_approvals FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin creates approval" ON public.cashflow_approvals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.cashflow_reports r WHERE r.id = report_id AND r.employee_id = cashflow_approvals.employee_id AND r.submitted_at = cashflow_approvals.submitted_at));
CREATE POLICY "Admin updates approval" ON public.cashflow_approvals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin') AND EXISTS (SELECT 1 FROM public.cashflow_reports r WHERE r.id = report_id AND r.employee_id = cashflow_approvals.employee_id AND r.submitted_at = cashflow_approvals.submitted_at));

-- ---- 0002_archive_cashflow_submissions.sql
CREATE TABLE public.cashflow_submission_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.cashflow_reports(id),
  employee_id uuid NOT NULL,
  sheet text NOT NULL,
  rows jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, submitted_at)
);
GRANT SELECT ON public.cashflow_submission_backups TO authenticated;
GRANT ALL ON public.cashflow_submission_backups TO service_role;
ALTER TABLE public.cashflow_submission_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employee reads own backups and admin reads all backups" ON public.cashflow_submission_backups FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.archive_cashflow_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cashflow_submission_backups (report_id, employee_id, sheet, rows, submitted_at)
  VALUES (NEW.id, NEW.employee_id, NEW.sheet, NEW.rows, NEW.submitted_at);
  RETURN NEW;
END;
$$;
CREATE TRIGGER archive_cashflow_submission_on_insert AFTER INSERT ON public.cashflow_reports FOR EACH ROW EXECUTE FUNCTION public.archive_cashflow_submission();
CREATE TRIGGER archive_cashflow_submission_on_resubmit AFTER UPDATE OF submitted_at ON public.cashflow_reports FOR EACH ROW WHEN (OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) EXECUTE FUNCTION public.archive_cashflow_submission();
CREATE INDEX cashflow_submission_backups_employee_sheet_idx ON public.cashflow_submission_backups(employee_id, sheet, submitted_at DESC);

