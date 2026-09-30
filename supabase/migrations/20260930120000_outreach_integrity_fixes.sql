-- A consumed correlation is an audit record, not ownership. The unipile_accounts
-- primary key already enforces one owner, and reconnecting an account that
-- Unipile kept must be able to consume a new correlation for the same ID.
alter table app.unipile_correlations drop constraint unipile_correlations_account_id_key;
create index unipile_correlations_account_idx on app.unipile_correlations(account_id);

