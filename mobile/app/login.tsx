import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi, getAppConfig, saveAppConfig, getAccessToken } from '@/lib/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SymbolView } from 'expo-symbols';

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Advanced config state
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [keycloakIssuer, setKeycloakIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Load existing config and check active session on mount
  useEffect(() => {
    async function loadData() {
      const config = await getAppConfig();
      setApiUrl(config.apiUrl);
      setKeycloakIssuer(config.keycloakIssuer);
      setClientId(config.clientId);
      setClientSecret(config.clientSecret);

      const token = await getAccessToken();
      if (token) {
        // Se c'è già un token, andiamo alla home
        router.replace('/(tabs)');
      }
    }
    loadData();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setErrorMsg('Inserisci username e password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Salva prima la config se l'utente l'ha modificata nel pannello avanzato
      await saveAppConfig({
        apiUrl,
        keycloakIssuer,
        clientId,
        clientSecret,
      });

      await authApi.login(username, password);
      setLoading(false);
      router.replace('/(tabs)');
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Errore di autenticazione');
    }
  };

  const handleSaveConfig = async () => {
    try {
      await saveAppConfig({
        apiUrl,
        keycloakIssuer,
        clientId,
        clientSecret,
      });
      setErrorMsg('Configurazione salvata con successo!');
      setTimeout(() => setErrorMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg('Errore nel salvataggio della configurazione');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo / Header Area */}
          <View style={styles.headerContainer}>
            <View style={[styles.logoIcon, { backgroundColor: colors.primaryLight }]}>
              <SymbolView
                name={{ ios: 'brain.head.profile', android: 'psychology', web: 'psychology' }}
                size={48}
                tintColor={colors.primary}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>LLMind2 Mobile</Text>
            <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
              Piattaforma di Ricerca in Clinical AI
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>Accesso Operatore</Text>

            {errorMsg && (
              <View
                style={[
                  styles.errorCallout,
                  {
                    backgroundColor: errorMsg.includes('successo') ? colors.primaryLight : '#fee2e2',
                    borderColor: errorMsg.includes('successo') ? colors.primary : colors.danger,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.errorText,
                    { color: errorMsg.includes('successo') ? colors.primary : colors.danger },
                  ]}
                >
                  {errorMsg}
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Username / Email</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder="Inserisci il tuo username..."
                placeholderTextColor={colors.tabIconDefault}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder="Inserisci la password..."
                placeholderTextColor={colors.tabIconDefault}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Accedi</Text>
              )}
            </Pressable>
          </View>

          {/* Toggle Advanced Config */}
          <Pressable
            style={styles.configToggle}
            onPress={() => setShowConfig(!showConfig)}
          >
            <SymbolView
              name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
              size={16}
              tintColor={colors.accent}
            />
            <Text style={[styles.configToggleText, { color: colors.accent }]}>
              {showConfig ? 'Nascondi Configurazione Server' : 'Configurazione Connessione'}
            </Text>
          </Pressable>

          {showConfig && (
            <View
              style={[
                styles.configCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.configTitle, { color: colors.text }]}>Impostazioni API & OIDC</Text>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>API URL del Backend</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="Es. http://localhost:10000"
                  placeholderTextColor={colors.tabIconDefault}
                  autoCapitalize="none"
                />
                <Text style={[styles.tipText, { color: colors.tabIconDefault }]}>
                  * Su Android Emulator usare http://10.0.2.2:10000
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Keycloak Issuer URL</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={keycloakIssuer}
                  onChangeText={setKeycloakIssuer}
                  placeholder="Es. https://keycloak.../realms/llmind2"
                  placeholderTextColor={colors.tabIconDefault}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Client ID</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={clientId}
                  onChangeText={setClientId}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Client Secret</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={clientSecret}
                  onChangeText={setClientSecret}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.configButton,
                  { borderColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleSaveConfig}
              >
                <Text style={[styles.configButtonText, { color: colors.accent }]}>Salva Configurazione</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorCallout: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  tipText: {
    fontSize: 11,
    marginTop: 4,
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  configToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  configToggleText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  configCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  configTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  configButton: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  configButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
