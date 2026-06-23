import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { patientsApi, Patient } from '@/lib/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function PatientsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [behaviors, setBehaviors] = useState('');
  const [specificTraits, setSpecificTraits] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');

  const [saving, setSaving] = useState(false);

  const fetchPatients = async (search?: string) => {
    setLoading(true);
    try {
      const data = await patientsApi.list(search);
      setPatients(data);
    } catch (err: any) {
      Alert.alert('Errore caricamento pazienti', err.message || 'Impossibile recuperare la lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(searchQuery);
  }, [searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingPatient(null);
    setName('');
    setAge('');
    setGender('');
    setBehaviors('');
    setSpecificTraits('');
    setClinicalHistory('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setName(patient.name);
    setAge(patient.age ? patient.age.toString() : '');
    setGender(patient.gender || '');
    setBehaviors(patient.behaviors || '');
    setSpecificTraits(patient.specific_traits || '');
    setClinicalHistory(patient.clinical_history || '');
    setModalVisible(true);
  };

  const handleSavePatient = async () => {
    if (!name) {
      Alert.alert('Errore di validazione', 'Il nome del paziente è obbligatorio.');
      return;
    }

    setSaving(true);
    const parsedAge = age ? parseInt(age, 10) : null;
    const payload = {
      name,
      age: isNaN(parsedAge as any) ? null : parsedAge,
      gender: gender || null,
      behaviors: behaviors || null,
      specific_traits: specificTraits || null,
      clinical_history: clinicalHistory || null,
    };

    try {
      if (editingPatient) {
        await patientsApi.update(editingPatient.id, payload);
      } else {
        await patientsApi.create(payload);
      }
      setModalVisible(false);
      fetchPatients(searchQuery);
    } catch (err: any) {
      Alert.alert('Errore nel salvataggio', err.message || 'Impossibile salvare i dati del paziente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = (patient: Patient) => {
    Alert.alert(
      'Elimina Paziente',
      `Sei sicuro di voler eliminare definitivamente il profilo di ${patient.name}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await patientsApi.delete(patient.id);
              fetchPatients(searchQuery);
            } catch (err: any) {
              Alert.alert('Errore nella cancellazione', err.message || 'Impossibile eliminare il paziente.');
            }
          },
        },
      ]
    );
  };

  const handleStartChat = (patient: Patient) => {
    // Naviga al tab chat passando il patient_id come query parameter
    router.push({
      pathname: '/(tabs)/chat',
      params: { patient_id: patient.id },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={colors.tabIconDefault}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Cerca per nome o sintomi..."
            placeholderTextColor={colors.tabIconDefault}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleOpenCreateModal}
        >
          <SymbolView
            name={{ ios: 'plus', android: 'add', web: 'add' }}
            size={20}
            tintColor="#ffffff"
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : patients.length === 0 ? (
        <View style={styles.centerContainer}>
          <SymbolView
            name={{ ios: 'person.crop.circle.badge.exclamationmark', android: 'person_off', web: 'person_off' }}
            size={48}
            tintColor={colors.tabIconDefault}
          />
          <Text style={[styles.noDataText, { color: colors.tabIconDefault }]}>
            Nessun paziente trovato. Crea un nuovo profilo o convertilo da un caso clinico.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {patients.map((patient) => (
            <View key={patient.id} style={[styles.patientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.patientInfo}>
                  <Text style={[styles.patientName, { color: colors.text }]}>{patient.name}</Text>
                  <Text style={[styles.patientMeta, { color: colors.tabIconDefault }]}>
                    {patient.gender ? `${patient.gender}` : 'Genere N.D.'}
                    {patient.age ? `, ${patient.age} anni` : ''}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable style={styles.actionIcon} onPress={() => handleOpenEditModal(patient)}>
                    <SymbolView
                      name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                      size={18}
                      tintColor={colors.accent}
                    />
                  </Pressable>
                  <Pressable style={styles.actionIcon} onPress={() => handleDeletePatient(patient)}>
                    <SymbolView
                      name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                      size={18}
                      tintColor={colors.danger}
                    />
                  </Pressable>
                </View>
              </View>

              {patient.behaviors && (
                <View style={styles.detailSec}>
                  <Text style={[styles.secLabel, { color: colors.tabIconDefault }]}>Sintomi & Comportamento:</Text>
                  <Text style={[styles.secValue, { color: colors.text }]} numberOfLines={2}>
                    {patient.behaviors}
                  </Text>
                </View>
              )}

              {patient.specific_traits && (
                <View style={styles.detailSec}>
                  <Text style={[styles.secLabel, { color: colors.tabIconDefault }]}>Tratti Clinici:</Text>
                  <Text style={[styles.secValue, { color: colors.text }]} numberOfLines={1}>
                    {patient.specific_traits}
                  </Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.chatBtn,
                  { backgroundColor: colors.primaryLight, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => handleStartChat(patient)}
              >
                <SymbolView
                  name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' }}
                  size={16}
                  tintColor={colors.primary}
                />
                <Text style={[styles.chatBtnText, { color: colors.primary }]}>Apri in Workspace Chat</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingPatient ? 'Modifica Paziente' : 'Nuovo Paziente'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={22}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Nome Paziente *</Text>
                <TextInput
                  style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Es. Mario Rossi o Paziente X..."
                  placeholderTextColor={colors.tabIconDefault}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 0.48 }]}>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Età</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
                    placeholder="Es. 34"
                    placeholderTextColor={colors.tabIconDefault}
                    keyboardType="numeric"
                    value={age}
                    onChangeText={setAge}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 0.48 }]}>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Genere</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
                    placeholder="Es. Maschio/Femmina"
                    placeholderTextColor={colors.tabIconDefault}
                    value={gender}
                    onChangeText={setGender}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Comportamenti / Sintomi Clinici</Text>
                <TextInput
                  style={[styles.modalInputMultiarea, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Fornisci una descrizione dettagliata dei sintomi o comportamenti osservati..."
                  placeholderTextColor={colors.tabIconDefault}
                  multiline
                  numberOfLines={4}
                  value={behaviors}
                  onChangeText={setBehaviors}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Tratti Specifici / Personalità</Text>
                <TextInput
                  style={[styles.modalInputMultiarea, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Tratti del temperamento, attitude psicologica, reattività..."
                  placeholderTextColor={colors.tabIconDefault}
                  multiline
                  numberOfLines={3}
                  value={specificTraits}
                  onChangeText={setSpecificTraits}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Storia Clinica / Anamnesi</Text>
                <TextInput
                  style={[styles.modalInputMultiarea, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Precedenti diagnosi, familiarità, insorgenza, durata dei sintomi..."
                  placeholderTextColor={colors.tabIconDefault}
                  multiline
                  numberOfLines={3}
                  value={clinicalHistory}
                  onChangeText={setClinicalHistory}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable
                style={[styles.footerBtn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Annulla</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.footerBtn,
                  { backgroundColor: colors.primary, opacity: pressed || saving ? 0.8 : 1 },
                ]}
                onPress={handleSavePatient}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Salva</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    height: '100%',
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  patientCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patientInfo: {
    flex: 1,
    marginRight: 8,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
  },
  patientMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionIcon: {
    padding: 6,
    marginLeft: 6,
  },
  detailSec: {
    marginBottom: 8,
  },
  secLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  secValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  chatBtn: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  chatBtnText: {
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalScroll: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalInputMultiarea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    minHeight: 80,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  footerBtn: {
    height: 48,
    borderRadius: 8,
    width: '48%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
