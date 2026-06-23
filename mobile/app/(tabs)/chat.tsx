import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  chatApi,
  patientsApi,
  gcpAgentsApi,
  Patient,
  GcpAgent,
  ChatModel,
  ChatMessage,
} from '@/lib/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Chat engine mode: 'ollama' | 'gcp'
  const [engineMode, setEngineMode] = useState<'ollama' | 'gcp'>('ollama');

  // Ollama Mode configuration
  const [chatMode, setChatMode] = useState<'icd11' | 'wellbeing'>('icd11');
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // GCP Mode configuration
  const [gcpAgents, setGcpAgents] = useState<GcpAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Conversation state
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Modal selector states
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  
  // Session History State
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('Nuova Chat');
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Initializing new Session UUID
  const initNewSession = () => {
    const newSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    setSessionId(newSessionId);
    setMessages([]);
    setActiveSessionTitle('Nuova Chat');
  };

  const loadSessionHistory = async (sessId: string) => {
    setLoadingSessions(true);
    try {
      const history = await chatApi.getSessionHistory(sessId);
      setSessionId(history.id);
      setMessages(history.messages);
      setActiveSessionTitle(history.title || 'Conversazione');
      if (history.mode === 'icd11' || history.mode === 'wellbeing') {
        setChatMode(history.mode);
      }
      setSelectedPatientId(history.patient_id);
      setEngineMode('ollama');
      setSessionModalVisible(false);
    } catch (err: any) {
      Alert.alert('Errore caricamento cronologia', err.message || 'Impossibile recuperare i messaggi.');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleOpenSessionsModal = async () => {
    setSessionModalVisible(true);
    setLoadingSessions(true);
    try {
      const data = await chatApi.listSessions();
      setSessions(data);
    } catch (err: any) {
      console.warn('Errore caricamento lista sessioni:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Load configurations
  const loadInitialData = async () => {
    try {
      // Load Ollama models
      const modelsData = await chatApi.getModels();
      setModels(modelsData.models);
      setSelectedModel(modelsData.default_model || (modelsData.models[0]?.name || ''));

      // Load Patients
      const patientsData = await patientsApi.list();
      setPatients(patientsData);

      // Load GCP Agents
      const gcpData = await gcpAgentsApi.list();
      setGcpAgents(gcpData.agents);
      if (gcpData.agents.length > 0) {
        setSelectedAgentId(gcpData.agents[0].id);
      }
    } catch (err) {
      console.warn('Errore nel caricamento configurazioni chat:', err);
    }
  };

  useEffect(() => {
    initNewSession();
    loadInitialData();
  }, []);

  // Monitor parameter changes (e.g. from Patients list "Start Chat")
  useEffect(() => {
    if (params.patient_id) {
      const pId = params.patient_id as string;
      setEngineMode('ollama');
      setChatMode('icd11');
      setSelectedPatientId(pId);
      initNewSession();
    }
  }, [params.patient_id]);

  const handleClearHistory = () => {
    Alert.alert(
      'Cancella Conversazione',
      'Vuoi azzerare la sessione di chat e iniziare una nuova discussione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Cancella',
          style: 'destructive',
          onPress: () => {
            initNewSession();
          },
        },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const messageContent = inputText.trim();
    setInputText('');
    setIsTyping(true);

    // 1. Add User Message immediately
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      session_id: sessionId,
      role: 'user',
      content: messageContent,
      mode: engineMode === 'ollama' ? chatMode : 'gcp',
      model_name: engineMode === 'ollama' ? selectedModel : selectedAgentId,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    // 2. Query proper agent
    if (engineMode === 'ollama') {
      // Local Ollama flow (Streaming)
      const assistantMsgId = Math.random().toString();
      let streamContent = '';

      // Place placeholder assistant bubble
      const initialAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        session_id: sessionId,
        role: 'assistant',
        content: '',
        mode: chatMode,
        model_name: selectedModel,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);

      await chatApi.streamChat(
        {
          session_id: sessionId,
          message: messageContent,
          mode: chatMode,
          model_name: selectedModel,
          patient_id: selectedPatientId,
        },
        (chunk) => {
          streamContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: streamContent } : msg
            )
          );
          scrollViewRef.current?.scrollToEnd({ animated: false });
        },
        (err) => {
          setIsTyping(false);
          Alert.alert('Errore di Connessione', err.message || 'Impossibile completare la risposta.');
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId));
        },
        () => {
          setIsTyping(false);
          chatApi.getSessionHistory(sessionId)
            .then((hist) => {
              if (hist && hist.title) {
                setActiveSessionTitle(hist.title);
              }
            })
            .catch(() => {});
        }
      );
    } else {
      // GCP Dialogflow flow (non-streaming)
      try {
        const response = await gcpAgentsApi.chat(selectedAgentId, messageContent, sessionId);
        const gcpAssistantMsg: ChatMessage = {
          id: Math.random().toString(),
          session_id: response.session_id,
          role: 'assistant',
          content: response.answer,
          mode: 'gcp',
          model_name: response.agent_id,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, gcpAssistantMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (err: any) {
        Alert.alert(
          'Errore GCP Agent',
          err.message || 'Errore durante la conversazione con Dialogflow CX. Verifica le impostazioni GCP.'
        );
      } finally {
        setIsTyping(false);
      }
    }
  };

  const getSelectedPatientName = () => {
    if (!selectedPatientId) return 'Nessun Contesto Paziente';
    const patient = patients.find((p) => p.id === selectedPatientId);
    return patient ? patient.name : 'Seleziona Paziente';
  };

  const getSelectedAgentName = () => {
    const agent = gcpAgents.find((a) => a.id === selectedAgentId);
    return agent ? agent.name : 'Seleziona Agente';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Selector Area: Ollama vs GCP */}
      <View style={[styles.headerSelectors, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.engineToggleRow}>
          <Pressable
            style={[
              styles.engineToggleBtn,
              engineMode === 'ollama' && [styles.engineToggleBtnActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => {
              setEngineMode('ollama');
              initNewSession();
            }}
          >
            <Text
              style={[
                styles.engineToggleText,
                { color: engineMode === 'ollama' ? '#ffffff' : colors.text },
              ]}
            >
              Local Ollama
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.engineToggleBtn,
              engineMode === 'gcp' && [styles.engineToggleBtnActive, { backgroundColor: colors.accent }],
            ]}
            onPress={() => {
              setEngineMode('gcp');
              initNewSession();
            }}
          >
            <Text
              style={[
                styles.engineToggleText,
                { color: engineMode === 'gcp' ? '#ffffff' : colors.text },
              ]}
            >
              GCP Agents
            </Text>
          </Pressable>
        </View>

        {/* Session history selector (Ollama only) */}
        {engineMode === 'ollama' && (
          <View style={styles.sessionToggleRow}>
            <Pressable
              style={[styles.sessionPickerTrigger, { borderColor: colors.border }]}
              onPress={handleOpenSessionsModal}
            >
              <View style={styles.pickerTriggerRow}>
                <SymbolView
                  name={{ ios: 'clock.arrow.2.circlepath', android: 'history', web: 'history' }}
                  size={16}
                  tintColor={colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.pickerLabel, { color: colors.text }]} numberOfLines={1}>
                  {activeSessionTitle || 'Carica Sessione...'}
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }}
                size={14}
                tintColor={colors.text}
              />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.newChatBtn,
                { backgroundColor: colors.primaryLight, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={initNewSession}
            >
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                size={16}
                tintColor={colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.newChatBtnText, { color: colors.primary }]}>Nuova</Text>
            </Pressable>
          </View>
        )}

        {/* Dynamic selector options based on Mode */}
        {engineMode === 'ollama' ? (
          <View style={styles.subConfigRow}>
            {/* Mode Select (icd11/wellbeing) */}
            <View style={[styles.modeToggle, { borderColor: colors.border }]}>
              <Pressable
                style={[
                  styles.modeBtn,
                  chatMode === 'icd11' && [styles.modeBtnActive, { backgroundColor: colors.primaryLight }],
                ]}
                onPress={() => setChatMode('icd11')}
              >
                <Text style={[styles.modeText, { color: chatMode === 'icd11' ? colors.primary : colors.text }]}>
                  ICD-11
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeBtn,
                  chatMode === 'wellbeing' && [styles.modeBtnActive, { backgroundColor: colors.primaryLight }],
                ]}
                onPress={() => setChatMode('wellbeing')}
              >
                <Text
                  style={[styles.modeText, { color: chatMode === 'wellbeing' ? colors.primary : colors.text }]}
                >
                  Well-being
                </Text>
              </Pressable>
            </View>

            {/* Model Dropdown Trigger */}
            <Pressable
              style={[styles.pickerTrigger, { borderColor: colors.border }]}
              onPress={() => setModelModalVisible(true)}
            >
              <Text style={[styles.pickerLabel, { color: colors.text }]} numberOfLines={1}>
                {selectedModel || 'Modello'}
              </Text>
              <SymbolView
                name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }}
                size={14}
                tintColor={colors.text}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.subConfigRow}>
            {/* GCP Agent Dropdown Trigger */}
            <Pressable
              style={[styles.pickerTriggerFull, { borderColor: colors.border }]}
              onPress={() => setAgentModalVisible(true)}
            >
              <View style={styles.pickerTriggerRow}>
                <SymbolView
                  name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                  size={16}
                  tintColor={colors.accent}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.pickerLabel, { color: colors.text }]} numberOfLines={1}>
                  {getSelectedAgentName()}
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }}
                size={14}
                tintColor={colors.text}
              />
            </Pressable>
          </View>
        )}

        {/* Ollama Patient Injection Context Selector */}
        {engineMode === 'ollama' && (
          <View style={styles.contextContainer}>
            <Pressable
              style={[
                styles.patientSelector,
                {
                  borderColor: selectedPatientId ? colors.primary : colors.border,
                  backgroundColor: selectedPatientId ? colors.primaryLight : 'transparent',
                },
              ]}
              onPress={() => setPatientModalVisible(true)}
            >
              <View style={styles.patientSelectorRow}>
                <SymbolView
                  name={{ ios: 'person.fill.viewfinder', android: 'portrait', web: 'portrait' }}
                  size={16}
                  tintColor={selectedPatientId ? colors.primary : colors.tabIconDefault}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.patientSelectorText,
                    { color: selectedPatientId ? colors.primary : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {getSelectedPatientName()}
                </Text>
              </View>
              <View style={styles.patientRightRow}>
                {selectedPatientId && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedPatientId(null);
                    }}
                    style={{ padding: 4, marginRight: 4 }}
                  >
                    <SymbolView
                      name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                      size={16}
                      tintColor={colors.primary}
                    />
                  </Pressable>
                )}
                <SymbolView
                  name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }}
                  size={14}
                  tintColor={selectedPatientId ? colors.primary : colors.text}
                />
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {/* Messages Box */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.chatScroll}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <SymbolView
              name={{ ios: 'bubble.left.and.bubble.right', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
              size={54}
              tintColor={colors.tabIconDefault}
            />
            <Text style={[styles.emptyChatText, { color: colors.tabIconDefault }]}>
              {engineMode === 'ollama'
                ? `Workspace di Chat locale attivo. Puoi discutere dei criteri diagnostici dell'ICD-11${
                    selectedPatientId ? ' contestualizzando la discussione sul paziente selezionato.' : '.'
                  }`
                : 'Integrazione con GCP Dialogflow CX attiva. Parla in tempo reale con gli agenti pre-configurati.'}
            </Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <View
                key={msg.id}
                style={[
                  styles.msgRow,
                  { justifyContent: isUser ? 'flex-end' : 'flex-start' },
                ]}
              >
                {!isUser && (
                  <View
                    style={[
                      styles.avatarBubble,
                      { backgroundColor: engineMode === 'ollama' ? colors.primaryLight : colors.accentLight },
                    ]}
                  >
                    <SymbolView
                      name={
                        engineMode === 'ollama'
                          ? { ios: 'brain', android: 'psychology', web: 'psychology' }
                          : { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }
                      }
                      size={14}
                      tintColor={engineMode === 'ollama' ? colors.primary : colors.accent}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.msgBubble,
                    {
                      backgroundColor: isUser
                        ? engineMode === 'ollama'
                          ? colors.primary
                          : colors.accent
                        : colors.card,
                      borderColor: colors.border,
                      borderWidth: isUser ? 0 : 1,
                      borderBottomRightRadius: isUser ? 4 : 16,
                      borderBottomLeftRadius: isUser ? 16 : 4,
                    },
                  ]}
                >
                  <Text style={[styles.msgText, { color: isUser ? '#ffffff' : colors.text }]}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            );
          })
        )}
        {isTyping && (
          <View style={styles.msgRow}>
            <View
              style={[
                styles.avatarBubble,
                { backgroundColor: engineMode === 'ollama' ? colors.primaryLight : colors.accentLight },
              ]}
            >
              <ActivityIndicator
                size="small"
                color={engineMode === 'ollama' ? colors.primary : colors.accent}
              />
            </View>
            <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.typingText, { color: colors.tabIconDefault }]}>L'assistente sta scrivendo...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Form Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.clearBtn,
              { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleClearHistory}
          >
            <SymbolView
              name={{ ios: 'trash', android: 'delete', web: 'delete' }}
              size={20}
              tintColor={colors.danger}
            />
          </Pressable>

          <TextInput
            style={[styles.inputField, { color: colors.text, borderColor: colors.border, maxHeight: 100 }]}
            placeholder="Scrivi un messaggio per l'assistente..."
            placeholderTextColor={colors.tabIconDefault}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: engineMode === 'ollama' ? colors.primary : colors.accent,
                opacity: pressed || !inputText.trim() || isTyping ? 0.6 : 1,
              },
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <SymbolView
              name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
              size={18}
              tintColor="#ffffff"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL PATIENT SELECTOR */}
      <Modal visible={patientModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalCardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalCardTitle, { color: colors.text }]}>Seleziona Paziente per Contesto</Text>
              <Pressable onPress={() => setPatientModalVisible(false)}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <Pressable
                style={[
                  styles.optionItem,
                  { borderBottomColor: colors.border },
                  selectedPatientId === null && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => {
                  setSelectedPatientId(null);
                  setPatientModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selectedPatientId === null ? colors.primary : colors.text },
                  ]}
                >
                  Nessun Contesto (Chat Libera)
                </Text>
              </Pressable>
              {patients.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.optionItem,
                    { borderBottomColor: colors.border },
                    selectedPatientId === p.id && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => {
                    setSelectedPatientId(p.id);
                    setPatientModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: selectedPatientId === p.id ? colors.primary : colors.text },
                    ]}
                  >
                    {p.name} ({p.gender || 'Genere ND'}{p.age ? `, ${p.age} anni` : ''})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL MODEL SELECTOR */}
      <Modal visible={modelModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalCardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalCardTitle, { color: colors.text }]}>Seleziona Modello LLM Locale</Text>
              <Pressable onPress={() => setModelModalVisible(false)}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {models.length === 0 ? (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: colors.tabIconDefault, textAlign: 'center' }}>
                    Nessun modello trovato in locale. Verificare Ollama.
                  </Text>
                </View>
              ) : (
                models.map((m) => (
                  <Pressable
                    key={m.name}
                    style={[
                      styles.optionItem,
                      { borderBottomColor: colors.border },
                      selectedModel === m.name && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => {
                      setSelectedModel(m.name);
                      setModelModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: selectedModel === m.name ? colors.primary : colors.text },
                      ]}
                    >
                      {m.name} ({m.family})
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL GCP AGENT SELECTOR */}
      <Modal visible={agentModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalCardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalCardTitle, { color: colors.text }]}>Seleziona Agente Dialogflow CX</Text>
              <Pressable onPress={() => setAgentModalVisible(false)}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {gcpAgents.map((agent) => (
                <Pressable
                  key={agent.id}
                  style={[
                    styles.optionItem,
                    { borderBottomColor: colors.border },
                    selectedAgentId === agent.id && { backgroundColor: colors.accentLight },
                  ]}
                  onPress={() => {
                    setSelectedAgentId(agent.id);
                    setAgentModalVisible(false);
                    initNewSession();
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: selectedAgentId === agent.id ? colors.accent : colors.text, fontWeight: '700' },
                    ]}
                  >
                    {agent.name} ({agent.short_name})
                  </Text>
                  <Text style={[styles.optionSubText, { color: colors.tabIconDefault }]} numberOfLines={1}>
                    {agent.description}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL SESSIONS SELECTOR */}
      <Modal visible={sessionModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalCardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalCardTitle, { color: colors.text }]}>Cronologia Sessioni Attive</Text>
              <Pressable onPress={() => setSessionModalVisible(false)}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {loadingSessions ? (
                <View style={{ padding: 20 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : sessions.length === 0 ? (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: colors.tabIconDefault, textAlign: 'center' }}>
                    Nessuna sessione di chat attiva trovata.
                  </Text>
                </View>
              ) : (
                sessions.map((s) => {
                  const patient = patients.find((p) => p.id === s.patient_id);
                  return (
                    <Pressable
                      key={s.id}
                      style={[
                        styles.optionItem,
                        { borderBottomColor: colors.border },
                        sessionId === s.id && { backgroundColor: colors.primaryLight },
                      ]}
                      onPress={() => loadSessionHistory(s.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: sessionId === s.id ? colors.primary : colors.text },
                        ]}
                      >
                        {s.title || 'Conversazione senza titolo'}
                      </Text>
                      <Text style={[styles.optionSubText, { color: colors.tabIconDefault }]}>
                        Modo: {s.mode} {patient ? `• Paziente: ${patient.name}` : ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSelectors: {
    padding: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  engineToggleRow: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    padding: 2,
    marginBottom: 8,
  },
  engineToggleBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  engineToggleBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  engineToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subConfigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 36,
  },
  sessionToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 36,
    width: '72%',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    height: 36,
    width: '25%',
  },
  newChatBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 6,
    height: '100%',
    width: '45%',
    overflow: 'hidden',
  },
  modeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeBtnActive: {
    height: '100%',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: '100%',
    width: '50%',
  },
  pickerTriggerFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: '100%',
    width: '100%',
  },
  pickerTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '85%',
  },
  contextContainer: {
    marginTop: 8,
  },
  patientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
  },
  patientSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  patientSelectorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  patientRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatScroll: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyChatText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    maxWidth: '85%',
  },
  avatarBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  msgBubble: {
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  typingBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal selector styling
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  modalCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionSubText: {
    fontSize: 11,
    marginTop: 2,
  },
});
