import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Card, ListRow, SectionLabel } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { Footnote, Section, SettingsHero } from "@/components/settings-ui";
import {
  getPayoutAccount,
  setupPayoutAccount,
  STRIPE_MODE,
  TEST_FUNDING_SOURCES,
  type PayoutAccount,
} from "@/services/payments";
import { useTheme } from "@/theme/theme-provider";

const STATE_LABEL: Record<PayoutAccount["state"], string> = {
  not_started: "Not set up",
  incomplete: "Needs details",
  ready: "Ready",
};

export default function Bank() {
  return STRIPE_MODE ? <StripeBank /> : <TestBank />;
}

function StripeBank() {
  const { colors } = useTheme();
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayoutAccount()
      .then(setAccount)
      .catch(() => setError("Couldn’t reach Stripe."));
  }, []);

  const setup = async () => {
    setBusy(true);
    setError(null);
    try {
      setAccount(await setupPayoutAccount());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t open Stripe.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="back"
      scroll
      footer={
        account && account.state !== "ready" ? (
          <Button
            label={
              account.state === "not_started"
                ? "Set up cash out with Stripe"
                : "Finish Stripe setup"
            }
            loading={busy}
            onPress={setup}
          />
        ) : undefined
      }
    >
      <SettingsHero
        icon="bank"
        title="Bank & card"
        body="Where money comes from when you add it, and where it goes when you cash out."
      />
      <Section index={1}>
        <SectionLabel>Add money</SectionLabel>
        <Card>
          <ListRow
            icon="card"
            label="Card"
            value="Entered in Stripe’s checkout"
            last
          />
        </Card>
        <Footnote>
          Card details go straight to Stripe. Payvr never sees or stores card
          numbers.
        </Footnote>
      </Section>

      <Section index={2}>
        <SectionLabel>Cash out</SectionLabel>
        <Card>
          {account ? (
            <ListRow
              icon="bank"
              label={account.bank ?? "Stripe account"}
              value={STATE_LABEL[account.state]}
              last
            />
          ) : error ? (
            <ListRow
              icon="bank"
              label="Stripe account"
              value="Unavailable"
              last
            />
          ) : (
            <ActivityIndicator style={styles.loading} color={colors.accent} />
          )}
        </Card>
        <Footnote tone={error ? "error" : "muted"}>
          {error ??
            "Cash-outs go to your own Stripe account (Stripe Connect), then to your bank. Stripe test mode: no real money."}
        </Footnote>
      </Section>
    </Screen>
  );
}

function TestBank() {
  return (
    <Screen
      back="back"
      scroll
      footer={
        <Button
          label="Link another (test)"
          variant="secondary"
          icon="plus"
          disabled
        />
      }
    >
      <SettingsHero
        icon="bank"
        title="Bank & card"
        body="Where money comes from when you add it, and where it goes when you cash out."
      />
      <Section index={1} style={styles.card}>
        <Card>
          {TEST_FUNDING_SOURCES.map((s, i) => (
            <ListRow
              key={s.id}
              icon={s.kind === "bank" ? "bank" : "card"}
              label={s.label}
              value={s.kind === "bank" ? "Cash out" : "Add money"}
              last={i === TEST_FUNDING_SOURCES.length - 1}
            />
          ))}
        </Card>
        <Footnote>
          Stripe isn’t connected, so these are pretend test accounts. Add a
          Stripe test key to use Stripe (see docs/STRIPE.md).
        </Footnote>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20 },
  loading: { paddingVertical: 18 },
});
