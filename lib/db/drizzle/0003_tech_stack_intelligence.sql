-- Technographic Fingerprint Engine
CREATE TABLE IF NOT EXISTS customer_tech_stack (
  id serial PRIMARY KEY,
  domain varchar(255) NOT NULL,
  customer_id integer REFERENCES customers(id),
  lead_candidate_id integer REFERENCES lead_candidates(id),
  category varchar(50) NOT NULL,
  vendor varchar(100),
  product varchar(150),
  version varchar(50),
  confidence integer DEFAULT 50,
  detected_via varchar(50),
  evidence jsonb,
  security_risk varchar(20),
  security_note text,
  sales_signal varchar(30),
  first_seen_at timestamp DEFAULT now(),
  last_verified_at timestamp DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(domain, category, vendor, product)
);

CREATE INDEX IF NOT EXISTS idx_tech_stack_domain ON customer_tech_stack(domain);
CREATE INDEX IF NOT EXISTS idx_tech_stack_category ON customer_tech_stack(category, vendor);
CREATE INDEX IF NOT EXISTS idx_tech_stack_sales ON customer_tech_stack(sales_signal) WHERE sales_signal IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_security_maturity (
  id serial PRIMARY KEY,
  domain varchar(255) UNIQUE NOT NULL,
  customer_id integer REFERENCES customers(id),
  lead_candidate_id integer REFERENCES lead_candidates(id),
  maturity_score integer,
  maturity_level varchar(20),
  score_email_security integer,
  score_web_security integer,
  score_infrastructure integer,
  score_visibility integer,
  recommended_service varchar(100),
  recommendation_reason text,
  company_segment varchar(30),
  segment_signals text[],
  calculated_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Intelligence Report Engine
CREATE TABLE IF NOT EXISTS market_configs (
  id serial PRIMARY KEY,
  country_code varchar(5) UNIQUE NOT NULL,
  country_name_local varchar(100),
  language_code varchar(10),
  tlds text[],
  currency_code varchar(5),
  currency_symbol varchar(5),
  primary_regulation varchar(100),
  regulation_year integer,
  regulation_note text,
  sector_labels jsonb,
  linkedin_page_id varchar(100),
  min_domains_for_report integer DEFAULT 100,
  is_active boolean DEFAULT true,
  launched_at date,
  created_at timestamp DEFAULT now()
);

INSERT INTO market_configs (
  country_code, country_name_local, language_code,
  tlds, currency_code, currency_symbol,
  primary_regulation, regulation_year, regulation_note,
  sector_labels, min_domains_for_report, is_active
) VALUES
(
  'TR', 'Türkiye', 'tr',
  ARRAY['.com.tr', '.net.tr', '.org.tr', '.biz.tr', '.info.tr', '.gen.tr'],
  'TRY', '₺',
  'KVKK (6698) + 7545 Sayılı Siber Güvenlik Kanunu',
  2025,
  '50+ çalışan şirketlere Siber Güvenlik Sorumlusu zorunluluğu. Olay bildirim: 72 saat.',
  '{"finance":"Finans ve Bankacılık","health":"Sağlık","manufacturing":"Üretim ve Sanayi","retail":"Perakende ve E-ticaret","technology":"Teknoloji","logistics":"Lojistik ve Taşımacılık","energy":"Enerji","education":"Eğitim","public":"Kamu","other":"Diğer"}',
  200, true
),
(
  'AZ', 'Azərbaycan', 'az',
  ARRAY['.az', '.com.az', '.net.az', '.org.az'],
  'AZN', '₼',
  'Kibertəhlükəsizlik haqqında Azərbaycan Respublikasının Qanunu',
  2023,
  'Kritik informasiya infrastrukturu operatorlarına məcburi tələblər.',
  '{"finance":"Maliyyə və Bank","health":"Səhiyyə","manufacturing":"İstehsal","retail":"Pərakəndə ticarət","technology":"Texnologiya","energy":"Energetika","public":"Dövlət","other":"Digər"}',
  100, false
)
ON CONFLICT (country_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS intelligence_reports (
  id serial PRIMARY KEY,
  country_code varchar(5) REFERENCES market_configs(country_code),
  report_month integer NOT NULL,
  report_year integer NOT NULL,
  report_slug varchar(100) UNIQUE,
  status varchar(20) DEFAULT 'generating',
  domains_analyzed integer,
  date_range_start date,
  date_range_end date,
  data_sources text[],
  avg_risk_score decimal(5,2),
  critical_findings_count integer,
  pct_no_dmarc decimal(5,2),
  pct_no_waf decimal(5,2),
  pct_outdated_cms decimal(5,2),
  pct_open_critical_port decimal(5,2),
  pct_dark_web_leak decimal(5,2),
  most_used_waf varchar(100),
  most_used_mail_provider varchar(100),
  worst_sector varchar(50),
  best_sector varchar(50),
  month_over_month_change decimal(5,2),
  executive_summary text,
  key_findings jsonb,
  sector_analysis jsonb,
  recommendations text,
  regulation_context text,
  linkedin_post_short text,
  linkedin_carousel jsonb,
  pdf_url varchar(500),
  blog_post_content text,
  email_subject varchar(255),
  email_preview text,
  email_html text,
  press_release text,
  published_at timestamp,
  linkedin_posted_at timestamp,
  linkedin_post_url varchar(500),
  email_sent_at timestamp,
  email_recipients integer,
  total_downloads integer DEFAULT 0,
  total_leads_captured integer DEFAULT 0,
  generated_by varchar(50) DEFAULT 'auto',
  reviewed_by varchar(100),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_sector_details (
  id serial PRIMARY KEY,
  report_id integer REFERENCES intelligence_reports(id) ON DELETE CASCADE,
  country_code varchar(5),
  sector varchar(50),
  domain_count integer,
  avg_risk_score decimal(5,2),
  pct_no_dmarc decimal(5,2),
  pct_no_waf decimal(5,2),
  pct_outdated_cms decimal(5,2),
  pct_open_port decimal(5,2),
  pct_dark_web decimal(5,2),
  most_common_waf varchar(100),
  most_common_mail varchar(100),
  most_common_cms varchar(100),
  maturity_level varchar(20),
  yoy_change decimal(5,2),
  sector_rank integer,
  narrative text
);

CREATE TABLE IF NOT EXISTS report_city_details (
  id serial PRIMARY KEY,
  report_id integer REFERENCES intelligence_reports(id) ON DELETE CASCADE,
  country_code varchar(5),
  city varchar(100),
  domain_count integer,
  avg_risk_score decimal(5,2),
  risk_rank integer
);

CREATE TABLE IF NOT EXISTS report_tech_trends (
  id serial PRIMARY KEY,
  report_id integer REFERENCES intelligence_reports(id) ON DELETE CASCADE,
  country_code varchar(5),
  category varchar(50),
  vendor varchar(100),
  domain_count integer,
  market_share_pct decimal(5,2),
  mom_change decimal(5,2)
);

CREATE TABLE IF NOT EXISTS report_leads (
  id serial PRIMARY KEY,
  report_id integer REFERENCES intelligence_reports(id),
  country_code varchar(5),
  name varchar(255),
  email varchar(255),
  company varchar(255),
  title varchar(255),
  downloaded_at timestamp DEFAULT now(),
  converted_to_isr boolean DEFAULT false,
  isr_customer_id integer REFERENCES isr_customers(id)
);
