ALTER TABLE cash_sessions ADD branch_id text REFERENCES branches(id);
--> statement-breakpoint
ALTER TABLE cash_sessions ADD terminal_id text REFERENCES terminals(id);
--> statement-breakpoint
ALTER TABLE cash_sessions ADD opening_amount_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD closing_amount_minor integer;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD expected_amount_minor integer;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD difference_minor integer;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD count_id text;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD approval_status text DEFAULT 'not_required' NOT NULL;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD approved_by text REFERENCES app_users(id);
--> statement-breakpoint
ALTER TABLE cash_sessions ADD approved_at text;
--> statement-breakpoint
ALTER TABLE cash_sessions ADD approval_reason text;
--> statement-breakpoint
ALTER TABLE cash_movements ADD amount_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE cash_movements ADD affects_cash integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE cash_movements ADD approved_by text REFERENCES app_users(id);
--> statement-breakpoint
ALTER TABLE sales ADD terminal_id text REFERENCES terminals(id);
--> statement-breakpoint
ALTER TABLE sales ADD register_id text REFERENCES cash_registers(id);
--> statement-breakpoint
ALTER TABLE sales ADD cash_session_id text REFERENCES cash_sessions(id);
--> statement-breakpoint
CREATE TABLE terminal_user_access (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  terminal_id text NOT NULL REFERENCES terminals(id),
  user_id text NOT NULL REFERENCES app_users(id),
  active integer DEFAULT 1 NOT NULL,
  granted_by text REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX terminal_user_access_uq ON terminal_user_access(terminal_id,user_id);
--> statement-breakpoint
CREATE TABLE cash_counts (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  session_id text NOT NULL REFERENCES cash_sessions(id),
  user_id text NOT NULL REFERENCES app_users(id),
  declared_amount_minor integer NOT NULL CHECK(declared_amount_minor>=0),
  expected_amount_minor integer NOT NULL,
  difference_minor integer NOT NULL,
  denominations text DEFAULT '{}' NOT NULL,
  notes text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX cash_counts_session_uq ON cash_counts(session_id);
--> statement-breakpoint
CREATE TABLE cash_events (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  session_id text NOT NULL REFERENCES cash_sessions(id),
  user_id text NOT NULL REFERENCES app_users(id),
  action text NOT NULL,
  amount_minor integer DEFAULT 0 NOT NULL,
  reason text NOT NULL,
  reference text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX cash_events_session_idx ON cash_events(tenant_id,session_id,created_at);
--> statement-breakpoint
INSERT OR IGNORE INTO terminals(id,tenant_id,branch_id,register_id,name,code,status)
SELECT 'terminal_'||r.id,r.tenant_id,r.branch_id,r.id,'Terminal '||r.name,'TERM-'||substr(r.id,1,12),'active' FROM cash_registers r
WHERE NOT EXISTS(SELECT 1 FROM terminals t WHERE t.register_id=r.id AND t.status='active');
--> statement-breakpoint
INSERT OR IGNORE INTO terminal_user_access(id,tenant_id,terminal_id,user_id,granted_by)
SELECT lower(hex(randomblob(16))),t.tenant_id,t.id,u.id,u.id FROM terminals t JOIN app_users u ON u.tenant_id=t.tenant_id JOIN user_branch_access a ON a.user_id=u.id AND a.branch_id=t.branch_id WHERE u.active=1;
--> statement-breakpoint
UPDATE cash_sessions SET branch_id=(SELECT branch_id FROM cash_registers r WHERE r.id=cash_sessions.register_id),terminal_id=(SELECT id FROM terminals t WHERE t.register_id=cash_sessions.register_id AND t.status='active' ORDER BY created_at LIMIT 1),opening_amount_minor=CAST(ROUND(opening_amount*100) AS INTEGER),closing_amount_minor=CASE WHEN closing_amount IS NULL THEN NULL ELSE CAST(ROUND(closing_amount*100) AS INTEGER) END,expected_amount_minor=CASE WHEN expected_amount IS NULL THEN NULL ELSE CAST(ROUND(expected_amount*100) AS INTEGER) END,difference_minor=CASE WHEN closing_amount IS NULL OR expected_amount IS NULL THEN NULL ELSE CAST(ROUND((closing_amount-expected_amount)*100) AS INTEGER) END;
--> statement-breakpoint
UPDATE cash_movements SET amount_minor=CAST(ROUND(amount*100) AS INTEGER),affects_cash=CASE WHEN movement_type IN ('sale_credit','sale_other') THEN 0 ELSE 1 END;
--> statement-breakpoint
CREATE UNIQUE INDEX cash_open_user_uq ON cash_sessions(tenant_id,user_id) WHERE status IN ('open','counted','pending_approval');
--> statement-breakpoint
CREATE UNIQUE INDEX cash_open_terminal_uq ON cash_sessions(terminal_id) WHERE status IN ('open','counted','pending_approval');
--> statement-breakpoint
CREATE UNIQUE INDEX cash_open_register_uq ON cash_sessions(register_id) WHERE status IN ('open','counted','pending_approval');
--> statement-breakpoint
CREATE TRIGGER cash_movement_type_guard BEFORE INSERT ON cash_movements WHEN NEW.movement_type NOT IN ('opening','income','expense','withdrawal','sale_cash','sale_return_cash') BEGIN SELECT RAISE(ABORT,'Tipo de movimiento de caja no permitido'); END;
