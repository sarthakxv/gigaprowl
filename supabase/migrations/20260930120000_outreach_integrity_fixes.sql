-- A consumed correlation is an audit record, not ownership. The unipile_accounts
-- primary key already enforces one owner, and reconnecting an account that
-- Unipile kept must be able to consume a new correlation for the same ID.
alter table app.unipile_correlations drop constraint unipile_correlations_account_id_key;
create index unipile_correlations_account_idx on app.unipile_correlations(account_id);

-- Dispatch attempts are append-only audit rows. Anchor them to the cadence so a
-- rewritten cadence can drop surplus never-actioned steps without losing them.
alter table app.dispatch_attempts drop constraint dispatch_attempts_cadence_id_step_index_user_id_fkey;
alter table app.dispatch_attempts
  add constraint dispatch_attempts_cadence_user_fkey
  foreign key (cadence_id, user_id) references app.cadences(id, user_id);
