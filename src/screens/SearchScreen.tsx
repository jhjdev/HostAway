import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import * as Icon from 'react-native-feather';

import {RootState} from '../store';
import Header from '../components/common/Header';
import {
  setSearchTerm,
  setSearchResults,
  addToSearchHistory,
  clearSearchResults,
  SearchResult,
  SearchHistoryItem,
  setSearchLoading,
  setSearchError,
} from '../store/slices/searchSlice';
import {searchLocations} from '../services/weatherApi';
import {getCurrentWeather} from '../services/weatherApi';

// Define LocationItem component outside of SearchScreen
interface LocationItemProps {
  item: SearchHistoryItem;
  onPress: () => void;
}

const LocationItem: React.FC<LocationItemProps> = ({item, onPress}) => (
  <TouchableOpacity onPress={onPress} style={styles.locationItem}>
    <Icon.MapPin stroke="#1565C0" width={20} height={20} />
    <View style={styles.locationItemContent}>
      <Text style={styles.locationItemName}>{item.name}</Text>
      <Text style={styles.locationItemCountry}>{item.country}</Text>
    </View>
  </TouchableOpacity>
);

interface SavedSearchesModalProps {
  visible: boolean;
  searchHistory: SearchHistoryItem[];
  onClose: () => void;
  onSelectLocation: (item: SearchHistoryItem) => void;
}

const SavedSearchesModal: React.FC<SavedSearchesModalProps> = ({
  visible,
  searchHistory,
  onClose,
  onSelectLocation,
}) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Saved Searches</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon.X stroke="#000" width={24} height={24} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={searchHistory}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <LocationItem
              item={item}
              onPress={() => {
                onSelectLocation(item);
                onClose();
              }}
            />
          )}
          style={styles.modalList}
        />
      </View>
    </View>
  </Modal>
);

interface RecentSearchesProps {
  searchHistory: SearchHistoryItem[];
  onSelectLocation: (item: SearchHistoryItem) => void;
}

const RecentSearches: React.FC<RecentSearchesProps> = ({
  searchHistory,
  onSelectLocation,
}) => (
  <View style={styles.recentSearchesContainer}>
    <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
    {searchHistory.slice(0, 3).map(item => (
      <LocationItem
        key={item.id}
        item={item}
        onPress={() => onSelectLocation(item)}
      />
    ))}
  </View>
);

interface SearchResultItemProps {
  item: SearchResult;
  onPress: (item: SearchResult) => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({item, onPress}) => (
  <TouchableOpacity style={styles.resultItem} onPress={() => onPress(item)}>
    <Icon.MapPin stroke="#1565C0" width={20} height={20} />
    <View style={styles.resultTextContainer}>
      <Text style={styles.resultName}>{item.name}</Text>
      <Text style={styles.resultCountry}>{item.country}</Text>
    </View>
    <Icon.ChevronRight stroke="#C7C7CC" width={20} height={20} />
  </TouchableOpacity>
);

const SearchScreen: React.FC = () => {
  // Log the actual data we're working with
  const searchState = useSelector((state: RootState) => state.search);
  console.log(
    'Search History Data:',
    JSON.stringify(searchState.searchHistory, null, 2),
  );
  console.log(
    'CURRENT REDUX STATE:',
    useSelector((state: RootState) => state.search),
  );
  const dispatch = useDispatch();
  const {
    searchResults,
    searchHistory,
    isLoading,
    error: searchApiError,
    currentSearchTerm,
  } = useSelector((state: RootState) => state.search);
  const [selectedLocation, setSelectedLocation] = useState<SearchHistoryItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedLocationWeather, setSelectedLocationWeather] =
    useState<any>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Use the real API for location search
  useEffect(() => {
    const fetchLocations = async () => {
      if (currentSearchTerm.length > 2) {
        dispatch(setSearchLoading(true));
        try {
          console.log('Searching with term:', currentSearchTerm);
          const results = await searchLocations(currentSearchTerm);
          console.log('Raw API results:', JSON.stringify(results));

          dispatch(
            setSearchResults(
              results.map(item => ({
                id: item.id,
                name: item.name || 'Unknown',
                country: item.country || 'Unknown',
                lat: item.lat,
                lon: item.lon,
              })),
            ),
          );

          console.log('Dispatched results to Redux');
        } catch (searchErr) {
          console.error('Search failed:', searchErr);
          dispatch(setSearchError('Failed to search locations'));
        } finally {
          dispatch(setSearchLoading(false));
        }
      } else {
        dispatch(clearSearchResults());
      }
    };

    // Debounce the search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      fetchLocations();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentSearchTerm, dispatch]);

  const handleSearch = (text: string) => {
    dispatch(setSearchTerm(text));
  };

  // Fetch weather data for a selected location
  const fetchWeatherForLocation = useCallback(
    async (lat: number, lon: number) => {
      setIsLoadingWeather(true);
      setWeatherError(null);

      try {
        const weatherData = await getCurrentWeather(lat, lon);
        setSelectedLocationWeather(weatherData);
      } catch (weatherErr) {
        console.error('Error fetching weather for location:', weatherErr);
        setWeatherError('Failed to load weather data');
      } finally {
        setIsLoadingWeather(false);
      }
    },
    [],
  );

  // Handle selecting a location from search results
  const handleSelectLocation = useCallback(
    (location: SearchResult) => {
      console.log('Selected location details:', {
        name: location.name,
        country: location.country,
        id: location.id,
        lat: location.lat,
        lon: location.lon,
      });

      // Validate location data before creating history item
      if (!location.name || !location.country) {
        console.error('Invalid location data:', location);
        return;
      }

      // Add to search history with timestamp
      const historyItem: SearchHistoryItem = {
        ...location,
        timestamp: Math.floor(Date.now() / 1000),
      };

      console.log('Creating history item with data:', {
        name: historyItem.name,
        country: historyItem.country,
        id: historyItem.id,
        timestamp: historyItem.timestamp,
      });

      setSelectedLocation(historyItem);
      dispatch(addToSearchHistory(historyItem));
      dispatch(setSearchTerm(''));
      dispatch(clearSearchResults());
      Keyboard.dismiss();

      // Fetch weather for the selected location
      fetchWeatherForLocation(location.lat, location.lon);
    },
    [dispatch, fetchWeatherForLocation],
  );

  const handleClearSearch = () => {
    dispatch(setSearchTerm(''));
    dispatch(clearSearchResults());
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContainer}>
        <Header title="Search Location" />
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icon.Search stroke="#8E8E93" width={20} height={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a city"
              value={currentSearchTerm}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {currentSearchTerm.length > 0 && (
              <TouchableOpacity
                testID="clear-search-button"
                onPress={handleClearSearch}>
                <Icon.X stroke="#8E8E93" width={20} height={20} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              testID="search-loading-indicator"
              size="small"
              color="#007AFF"
            />
          </View>
        )}

        {searchApiError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{searchApiError}</Text>
          </View>
        )}

        {searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={({item}) => (
              <SearchResultItem item={item} onPress={handleSelectLocation} />
            )}
            keyExtractor={item => `result-${item.id}`}
            style={styles.resultsList}
          />
        ) : (
          currentSearchTerm.length > 0 &&
          !isLoading && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No results found</Text>
            </View>
          )
        )}

        {/* Weather display for selected location */}
        {selectedLocation && currentSearchTerm.length === 0 && (
          <View style={styles.selectedLocationContainer}>
            <View style={styles.locationHeader}>
              <Text style={styles.selectedLocationName}>
                {selectedLocation.name.toUpperCase()}
              </Text>
              <Text style={styles.selectedLocationCountry}>
                {selectedLocation.country}
              </Text>
            </View>

            {isLoadingWeather ? (
              <View style={styles.weatherLoading}>
                <ActivityIndicator size="large" color="#1565C0" />
                <Text style={styles.weatherLoadingText}>
                  Loading weather data...
                </Text>
              </View>
            ) : weatherError ? (
              <View style={styles.weatherError}>
                <Icon.AlertCircle stroke="#FF3B30" width={40} height={40} />
                <Text style={styles.weatherErrorText}>{weatherError}</Text>
              </View>
            ) : (
              selectedLocationWeather && (
                <View style={styles.weatherContainer}>
                  <View style={styles.weatherMainInfo}>
                    <Text style={styles.temperature}>
                      {Math.round(selectedLocationWeather.current.temperature)}
                      °C
                    </Text>
                    <Text style={styles.weatherCondition}>
                      {selectedLocationWeather.current.condition.main}
                    </Text>
                  </View>

                  <View style={styles.weatherDetails}>
                    <View style={styles.weatherDetailItem}>
                      <Icon.Droplet stroke="#1565C0" width={20} height={20} />
                      <Text style={styles.weatherDetailLabel}>Humidity</Text>
                      <Text style={styles.weatherDetailValue}>
                        {selectedLocationWeather.current.humidity}%
                      </Text>
                    </View>

                    <View style={styles.weatherDetailItem}>
                      <Icon.Wind stroke="#1565C0" width={20} height={20} />
                      <Text style={styles.weatherDetailLabel}>Wind</Text>
                      <Text style={styles.weatherDetailValue}>
                        {selectedLocationWeather.current.windSpeed} m/s
                      </Text>
                    </View>

                    <View style={styles.weatherDetailItem}>
                      <Icon.Thermometer
                        stroke="#1565C0"
                        width={20}
                        height={20}
                      />
                      <Text style={styles.weatherDetailLabel}>Feels Like</Text>
                      <Text style={styles.weatherDetailValue}>
                        {Math.round(selectedLocationWeather.current.feelsLike)}
                        °C
                      </Text>
                    </View>
                  </View>
                </View>
              )
            )}
          </View>
        )}

        {/* Recent Searches */}
        {currentSearchTerm.length === 0 &&
          !selectedLocation &&
          searchHistory.length > 0 && (
            <RecentSearches
              searchHistory={searchHistory}
              onSelectLocation={handleSelectLocation}
            />
          )}

        {/* Saved Searches Modal */}
        <SavedSearchesModal
          visible={showHistoryModal}
          searchHistory={searchHistory}
          onClose={() => setShowHistoryModal(false)}
          onSelectLocation={handleSelectLocation}
        />

        {/* Saved Searches button moved to bottom of screen */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.savedSearchesButton}
            onPress={() => setShowHistoryModal(true)}>
            <Icon.BookOpen stroke="#FFFFFF" width={20} height={20} />
            <Text style={styles.savedSearchesButtonText}>Saved Searches</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  // Layout & General styles
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
  },

  // Search styles
  searchContainer: {
    paddingTop: 16,
    borderRadius: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginTop: 2,
    paddingLeft: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    height: 60,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFE5E5',
    margin: 16,
    borderRadius: 10,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#8E8E93',
  },

  // Search Results styles
  resultsList: {
    backgroundColor: '#FFFFFF',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  resultTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
  resultCountry: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // LocationItem styles
  locationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  locationItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  locationItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationItemCountry: {
    fontSize: 14,
    color: '#666',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    marginTop: 100,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalList: {
    backgroundColor: 'white',
  },

  // Recent searches styles
  recentSearchesContainer: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  recentSearchesTitle: {
    padding: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1565C0',
  },

  // Selected location and weather styles
  selectedLocationContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.23,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  locationHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  selectedLocationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    letterSpacing: 0.5,
  },
  selectedLocationCountry: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  weatherLoading: {
    padding: 40,
    alignItems: 'center',
  },
  weatherLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#757575',
  },
  weatherError: {
    padding: 40,
    alignItems: 'center',
  },
  weatherErrorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  weatherContainer: {
    padding: 20,
  },
  weatherMainInfo: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  temperature: {
    fontSize: 52,
    fontWeight: '200',
    color: '#212121',
    letterSpacing: 0.25,
  },
  weatherCondition: {
    fontSize: 20,
    color: '#757575',
    marginTop: 8,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginLeft: -20,
    marginRight: -20,
    marginBottom: -20,
    paddingLeft: 20,
    paddingRight: 20,
  },
  weatherDetailItem: {
    alignItems: 'center',
  },
  weatherDetailLabel: {
    fontSize: 14,
    color: '#757575',
    marginTop: 8,
  },
  weatherDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
  },

  // Bottom button styles
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    backgroundColor: 'rgba(249, 249, 249, 0.95)',
    paddingTop: 10,
  },
  savedSearchesButton: {
    flexDirection: 'row',
    backgroundColor: '#1565C0',
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  savedSearchesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default SearchScreen;
