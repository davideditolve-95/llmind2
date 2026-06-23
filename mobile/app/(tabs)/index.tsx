import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { getUserInfo, clearAuth, casesApi, patientsApi, chatApi, getAppConfig, AppConfig } from '@/lib/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [userInfo, setUserInfo] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [stats, setStats] = useState<{ total_cases: number; reviewed: number; pending_review: number } | null>(null);
  const [patientCount, setPatientCount] = useState<number>(0);
  const [ollamaStatus, setOllamaStatus] = useState<string>('checking...');
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const uInfo = await getUserInfo();
      setUserInfo(uInfo);

      const config = await getAppConfig();
      setAppConfig(config);

      // Fetch case stats
      const caseStats = await casesApi.getStats();
      setStats(caseStats);

      // Fetch patient count
      const plist = await patientsApi.list();
      setPatientCount(plist.length);

      // Fetch Ollama health
      const ollama = await chatApi.getHealth();
      setOllamaStatus(ollama.status);
    } catch (err) {
      console.error('Errore nel recupero dati dashboard:', err);
      setOllamaStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/login');
  };

  if (loading && !userInfo) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header operatore */}
        <View style={[styles.welcomeCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={styles.welcomeRow}>
            <View style={styles.avatar}>
              <SymbolView
                name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
                size={54}
                tintColor="#ffffff"
              />
            </View>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeTitle}>Benvenuto,</Text>
              <Text style={styles.welcomeEmail}>{userInfo?.email || userInfo?.preferred_username || 'Operatore'}</Text>
            </View>
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <SymbolView
                name={{ ios: 'power', android: 'logout', web: 'logout' }}
                size={22}
                tintColor="#ffffff"
              />
            </Pressable>
          </View>
        </View>

        {/* Status System Services */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Stato dei Servizi</Text>
        <View style={styles.row}>
          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SymbolView
              name={{ ios: 'network', android: 'dns', web: 'dns' }}
              size={24}
              tintColor={colors.primary}
            />
            <Text style={[styles.statusLabel, { color: colors.tabIconDefault }]}>Backend API</Text>
            <Text style={[styles.statusValue, { color: colors.success }]}>Online</Text>
          </View>

          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SymbolView
              name={{ ios: 'cpu', android: 'memory', web: 'memory' }}
              size={24}
              tintColor={ollamaStatus === 'online' ? colors.primary : colors.danger}
            />
            <Text style={[styles.statusLabel, { color: colors.tabIconDefault }]}>Ollama Local LLM</Text>
            <Text
              style={[
                styles.statusValue,
                { color: ollamaStatus === 'online' ? colors.success : colors.danger, textTransform: 'capitalize' },
              ]}
            >
              {ollamaStatus}
            </Text>
          </View>
        </View>

        {/* Database Stats */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Statistiche Cliniche</Text>
        <View style={[styles.statsCardWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{stats?.total_cases || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>Casi DSM-5 Totali</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.accent }]}>{patientCount}</Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>Pazienti Attivi</Text>
          </View>
        </View>

        {/* Case detail sub stats */}
        <View style={styles.row}>
          <View style={[styles.miniStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.miniStatHeader}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.miniStatTitle, { color: colors.text }]}>Casi Validati</Text>
            </View>
            <Text style={[styles.miniStatNum, { color: colors.text }]}>{stats?.reviewed || 0}</Text>
          </View>

          <View style={[styles.miniStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.miniStatHeader}>
              <View style={[styles.dot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.miniStatTitle, { color: colors.text }]}>Da Validare</Text>
            </View>
            <Text style={[styles.miniStatNum, { color: colors.text }]}>{stats?.pending_review || 0}</Text>
          </View>
        </View>

        {/* Connection Details */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Dettagli Configurazione</Text>
        <View style={[styles.configCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: colors.tabIconDefault }]}>API Base URL:</Text>
            <Text style={[styles.configVal, { color: colors.text }]} numberOfLines={1}>
              {appConfig?.apiUrl}
            </Text>
          </View>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: colors.tabIconDefault }]}>Keycloak Realm:</Text>
            <Text style={[styles.configVal, { color: colors.text }]} numberOfLines={1}>
              {appConfig?.keycloakIssuer?.split('/realms/').pop()}
            </Text>
          </View>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: colors.tabIconDefault }]}>OIDC Client ID:</Text>
            <Text style={[styles.configVal, { color: colors.text }]} numberOfLines={1}>
              {appConfig?.clientId}
            </Text>
          </View>
        </View>

        {/* Refresh button */}
        <Pressable
          style={({ pressed }) => [
            styles.refreshBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={loadDashboardData}
        >
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={16}
            tintColor="#ffffff"
          />
          <Text style={styles.refreshBtnText}>Aggiorna Dashboard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeEmail: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 12,
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusCard: {
    flex: 0.48,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statsCardWrapper: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: '100%',
  },
  miniStatCard: {
    flex: 0.48,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  miniStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  miniStatTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  miniStatNum: {
    fontSize: 20,
    fontWeight: '700',
    paddingLeft: 14,
  },
  configCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  configLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: '35%',
  },
  configVal: {
    fontSize: 13,
    fontWeight: '600',
    width: '65%',
    textAlign: 'right',
  },
  refreshBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
});
