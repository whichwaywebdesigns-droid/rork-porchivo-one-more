update public.profiles set preferred_language = 'es' where email = 'reviewer@porchivo.com';

select public.enqueue_template_email('high-risk-alert','reviewer@porchivo.com', id,'community','qa-es-safety-0912',
  jsonb_build_object('first_name','Eric','neighborhood','Willow Creek','radius','500 m','risk_level','Alto',
    'incident_count','3','last_incident_time','2026-09-12 08:15','risk_map_url','https://porchivo.com/safety'))
from public.profiles where email='reviewer@porchivo.com';

select public.enqueue_template_email('partner-request-received','reviewer@porchivo.com', id,'partners','qa-es-partner-0912',
  jsonb_build_object('first_name','Eric','requester_name','María López','requester_address','Calle Reforma 123',
    'start_date','15 sep 2026','end_date','20 sep 2026','package_count','2','request_url','https://porchivo.com/partners'))
from public.profiles where email='reviewer@porchivo.com';

select public.enqueue_template_email('subscription-started','reviewer@porchivo.com', id,'billing','qa-es-billing-0912',
  jsonb_build_object('first_name','Eric','plan_name','Professional','upgrade_or_start','comenzaste',
    'billing_cycle','mensual','amount','$3,690 MXN','next_billing_date','12 oct 2026','dashboard_url','https://porchivo.com/app'))
from public.profiles where email='reviewer@porchivo.com';

select public.enqueue_template_email('app-update','reviewer@porchivo.com', id,'marketing','qa-es-system-0912',
  jsonb_build_object('first_name','Eric','feature_name','Escudo Antirrobo','feature_description','Ahora con alertas en tiempo real.',
    'platforms','iOS y Android','app_version','1.0.9','release_date','12 sep 2026','update_url','https://porchivo.com/download'))
from public.profiles where email='reviewer@porchivo.com';

select public.enqueue_template_email('milestone','reviewer@porchivo.com', id,'community','qa-es-milestone-0912',
  jsonb_build_object('first_name','Eric','package_milestone','10','join_date','1 sep 2026','partner_uses','4',
    'theft_attempts_blocked','1','stats_url','https://porchivo.com/app/safety-score'))
from public.profiles where email='reviewer@porchivo.com';
