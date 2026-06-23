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
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { casesApi, patientsApi, DSM5CaseSummary, DSM5CaseResponse } from '@/lib/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function CasesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Cases list state
  const [cases, setCases] = useState<DSM5CaseSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCases, setTotalCases] = useState(0);
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<DSM5CaseResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [converting, setConverting] = useState(false);

  const fetchCases = async (currentPage: number, search?: string) => {
    setLoading(true);
    try {
      const data = await casesApi.list(currentPage, 10, search);
      setCases(data.items);
      setTotalPages(data.total_pages);
      setTotalCases(data.total);
    } catch (err: any) {
      Alert.alert('Errore caricamento casi', err.message || 'Impossibile caricare i casi clinici.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases(page, searchQuery);
  }, [page, searchQuery]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setPage(1); // Resetta alla prima pagina su nuova ricerca
  };

  const handleOpenDetail = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setLoadingDetail(true);
    try {
      const data = await casesApi.get(caseId);
      setSelectedCase(data);
    } catch (err: any) {
      Alert.alert('Errore caricamento dettagli', err.message || 'Impossibile caricare il dettaglio.');
      setSelectedCaseId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedCaseId(null);
    setSelectedCase(null);
  };

  const handleConvertToPatient = async () => {
    if (!selectedCase) return;

    setConverting(true);
    try {
      const newPatient = await patientsApi.convertFromCase(selectedCase.id);
      setConverting(false);
      handleCloseDetail();

      Alert.alert(
        'Estrazione Completata!',
        `Il caso clinico "${selectedCase.title}" è stato elaborato da Ollama ed è stato estratto il profilo del paziente "${newPatient.name}".`,
        [
          {
            text: 'Rimani qui',
            style: 'cancel',
          },
          {
            text: 'Apri Paziente',
            onPress: () => {
              router.push('/(tabs)/patients');
            },
          },
        ]
      );
    } catch (err: any) {
      setConverting(false);
      Alert.alert('Errore conversione', err.message || 'Impossibile estrarre le info del paziente.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={colors.tabIconDefault}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Cerca per codice, titolo o sintomi..."
            placeholderTextColor={colors.tabIconDefault}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : cases.length === 0 ? (
        <View style={styles.centerContainer}>
          <SymbolView
            name={{ ios: 'doc.text.magnifyingglass', android: 'find_in_page', web: 'find_in_page' }}
            size={48}
            tintColor={colors.tabIconDefault}
          />
          <Text style={[styles.noDataText, { color: colors.tabIconDefault }]}>
            Nessun caso clinico corrisponde ai criteri di ricerca.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.listContent}>
            {cases.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [
                  styles.caseCard,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => handleOpenDetail(c.id)}
              >
                <View style={styles.caseHeader}>
                  <View style={[styles.caseBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.caseBadgeText, { color: colors.primary }]}>
                      Caso {c.case_number}
                    </Text>
                  </View>
                  {c.is_reviewed && (
                    <View style={[styles.reviewedBadge, { backgroundColor: '#d1fae5' }]}>
                      <Text style={styles.reviewedBadgeText}>Validato</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.caseTitle, { color: colors.text }]}>{c.title}</Text>
                <Text style={[styles.casePreview, { color: colors.tabIconDefault }]} numberOfLines={3}>
                  {c.anamnesis_preview}...
                </Text>

                <View style={styles.caseFooter}>
                  <Text style={[styles.footerText, { color: colors.tabIconDefault }]}>
                    Pagina: {c.source_page || 'N.D.'} • Esecuzioni: {c.run_count}
                  </Text>
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={16}
                    tintColor={colors.primary}
                  />
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Pagination controls */}
          <View style={[styles.pagination, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              style={[styles.pageBtn, { borderColor: colors.border, opacity: page === 1 ? 0.4 : 1 }]}
              onPress={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
            >
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor={colors.text}
              />
            </Pressable>
            <Text style={[styles.pageText, { color: colors.text }]}>
              Pagina {page} di {totalPages} ({totalCases} casi)
            </Text>
            <Pressable
              style={[styles.pageBtn, { borderColor: colors.border, opacity: page === totalPages ? 0.4 : 1 }]}
              onPress={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
            >
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={18}
                tintColor={colors.text}
              />
            </Pressable>
          </View>
        </>
      )}

      {/* DETAIL MODAL */}
      <Modal visible={selectedCaseId !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalTitleContainer}>
                <Text style={[styles.modalBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>
                  Caso {selectedCase?.case_number}
                </Text>
                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                  {selectedCase?.title || 'Caricamento...'}
                </Text>
              </View>
              <Pressable onPress={handleCloseDetail} disabled={converting}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={22}
                  tintColor={colors.text}
                />
              </Pressable>
            </View>

            {loadingDetail ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <Text style={[styles.secTitle, { color: colors.text }]}>Presentazione Clinica (Anamnesi)</Text>
                <View style={[styles.textBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.bodyText, { color: colors.text }]}>{selectedCase?.anamnesis}</Text>
                </View>

                <Text style={[styles.secTitle, { color: colors.text }]}>Diagnosi Gold Standard (DSM-5-TR)</Text>
                <View style={[styles.textBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.bodyText, { color: colors.text }]}>{selectedCase?.gold_standard_diagnosis}</Text>
                </View>
              </ScrollView>
            )}

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable
                style={[styles.footerBtn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={handleCloseDetail}
                disabled={converting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Chiudi</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.footerBtn,
                  { backgroundColor: colors.primary, opacity: pressed || converting ? 0.8 : 1 },
                ]}
                onPress={handleConvertToPatient}
                disabled={converting || loadingDetail}
              >
                {converting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <SymbolView
                      name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
                      size={18}
                      tintColor="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.saveBtnText}>Converti in Paziente</Text>
                  </>
                )}
              </Pressable>
            </View>
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
  headerContainer: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
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
  caseCard: {
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
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  caseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  caseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reviewedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reviewedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  casePreview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  caseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageText: {
    fontSize: 13,
    fontWeight: '600',
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
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  modalBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  modalScroll: {
    padding: 20,
  },
  secTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  textBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
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
    flexDirection: 'row',
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
