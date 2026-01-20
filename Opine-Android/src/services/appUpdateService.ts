import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { apiService } from './api';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  latestVersionCode: number;
  downloadUrl: string;
  fileSize: number;
  fileHash?: string;
  releaseNotes?: string;
  isForceUpdate: boolean;
  minRequiredVersion?: string;
}

interface UpdateProgress {
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
}

type ProgressCallback = (progress: UpdateProgress) => void;

class AppUpdateService {
  private currentVersionCode: number;
  private isCheckingUpdate: boolean = false;
  private isDownloading: boolean = false;
  private lastCheckTime: number = 0;
  private readonly CHECK_INTERVAL = 30 * 60 * 1000; // Check every 30 minutes
  private readonly STORAGE_KEY_LAST_UPDATE_CHECK = 'lastUpdateCheck';
  private readonly STORAGE_KEY_SKIPPED_VERSION = 'skippedVersion';

  constructor() {
    // Get version code from app.json (Expo managed workflow)
    // Constants.expoConfig?.android?.versionCode is the versionCode from app.json
    // Constants.expoConfig?.version is the version string (e.g., "14")
    try {
      // Try multiple ways to get version code (Expo SDK compatibility)
      let versionCode: number | undefined;
      
      // Method 1: Try expoConfig (Expo SDK 50+)
      if (Constants.expoConfig?.android?.versionCode) {
        versionCode = Constants.expoConfig.android.versionCode;
      }
      // Method 2: Try manifest (Expo SDK <50)
      else if ((Constants.manifest as any)?.android?.versionCode) {
        versionCode = (Constants.manifest as any).android.versionCode;
      }
      // Method 3: Try parsing from version string
      else {
        const versionStr = Constants.expoConfig?.version || 
                          (Constants.manifest as any)?.version || 
                          '20';
        const parsed = parseInt(versionStr, 10);
        if (!isNaN(parsed)) {
          versionCode = parsed;
        }
      }
      
      this.currentVersionCode = versionCode || 20;
      
    } catch (error) {
      console.warn('⚠️ Could not read version code from Constants, using default: 20', error);
      this.currentVersionCode = 20;
    }
    
    console.log(`📱 App Update Service initialized - Current version code: ${this.currentVersionCode}`);
  }

  /**
   * Get current app version code
   */
  getCurrentVersionCode(): number {
    return this.currentVersionCode;
  }

  /**
   * Check for updates from server
   */
  async checkForUpdate(showProgress: boolean = false): Promise<UpdateInfo | null> {
    // Prevent concurrent checks
    if (this.isCheckingUpdate) {
      console.log('⏳ Update check already in progress...');
      return null;
    }

    try {
      this.isCheckingUpdate = true;
      const now = Date.now();

      // Throttle checks (don't check too frequently) - but allow forced checks
      if (showProgress) {
        // Force check - bypass throttling
        console.log('🔍 Checking for app updates (forced)...');
        this.lastCheckTime = now;
        await AsyncStorage.setItem(this.STORAGE_KEY_LAST_UPDATE_CHECK, now.toString());
      } else {
        // Regular check - apply throttling
        if (now - this.lastCheckTime < this.CHECK_INTERVAL) {
          console.log('⏱️ Update check throttled - checking too soon');
          return null;
        }
        this.lastCheckTime = now;
        await AsyncStorage.setItem(this.STORAGE_KEY_LAST_UPDATE_CHECK, now.toString());
      }

      const result = await apiService.checkAppUpdate(this.currentVersionCode);

      if (!result.success) {
        console.error('❌ Failed to check for updates:', result.error);
        return null;
      }

      if (!result.hasUpdate) {
        console.log('✅ App is up to date');
        return null;
      }

      // Check if user skipped this version
      const skippedVersion = await AsyncStorage.getItem(this.STORAGE_KEY_SKIPPED_VERSION);
      if (skippedVersion && parseInt(skippedVersion) === result.latestVersionCode) {
        console.log(`⏭️ Version ${result.latestVersionCode} was skipped by user`);
        return null;
      }

      const updateInfo: UpdateInfo = {
        hasUpdate: true,
        latestVersion: result.latestVersion || 'Unknown',
        latestVersionCode: result.latestVersionCode || this.currentVersionCode + 1,
        downloadUrl: result.downloadUrl || '',
        fileSize: result.fileSize || 0,
        fileHash: result.fileHash,
        releaseNotes: result.releaseNotes || 'Bug fixes and improvements',
        isForceUpdate: result.isForceUpdate || false,
        minRequiredVersion: result.minRequiredVersion
      };

      console.log(`📦 Update available: Version ${updateInfo.latestVersion} (Code: ${updateInfo.latestVersionCode})`);
      return updateInfo;

    } catch (error: any) {
      console.error('❌ Error checking for updates:', error);
      return null;
    } finally {
      this.isCheckingUpdate = false;
    }
  }

  /**
   * Download APK file
   */
  async downloadUpdate(
    downloadUrl: string,
    filename: string,
    progressCallback?: ProgressCallback
  ): Promise<{ success: boolean; fileUri?: string; error?: string }> {
    if (this.isDownloading) {
      return { success: false, error: 'Download already in progress' };
    }

    try {
      this.isDownloading = true;

      // Get download directory
      const downloadDir = `${FileSystem.documentDirectory}downloads/`;
      
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }

      // File path
      const fileUri = `${downloadDir}${filename}`;

      console.log(`📥 Downloading APK to: ${fileUri}`);
      console.log(`📥 Download URL: ${downloadUrl}`);

      // Download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const percentage = Math.round(progress * 100);
          
          if (progressCallback) {
            progressCallback({
              progress: percentage,
              downloadedBytes: downloadProgress.totalBytesWritten,
              totalBytes: downloadProgress.totalBytesExpectedToWrite
            });
          }

          console.log(`📥 Download progress: ${percentage}% (${(downloadProgress.totalBytesWritten / 1024 / 1024).toFixed(2)} MB / ${(downloadProgress.totalBytesExpectedToWrite / 1024 / 1024).toFixed(2)} MB)`);
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result) {
        throw new Error('Download failed - no result');
      }

      console.log(`✅ APK downloaded successfully: ${result.uri}`);

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists) {
        throw new Error('Downloaded file does not exist');
      }

      return {
        success: true,
        fileUri: result.uri
      };

    } catch (error: any) {
      console.error('❌ Error downloading update:', error);
      return {
        success: false,
        error: error.message || 'Failed to download update'
      };
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Install APK on Android
   */
  async installApk(fileUri: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (Platform.OS !== 'android') {
        return { success: false, error: 'APK installation only supported on Android' };
      }

      console.log(`📲 Installing APK: ${fileUri}`);

      // Get file info to ensure it exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        return { success: false, error: 'APK file not found' };
      }

      // On Android, use IntentLauncher to open the APK
      // This will trigger Android's package installer
      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive'
      });

      console.log('✅ APK installation initiated');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Error installing APK:', error);
      return {
        success: false,
        error: error.message || 'Failed to install APK'
      };
    }
  }

  /**
   * Mark a version as skipped
   */
  async skipVersion(versionCode: number): Promise<void> {
    await AsyncStorage.setItem(this.STORAGE_KEY_SKIPPED_VERSION, versionCode.toString());
    console.log(`⏭️ Version ${versionCode} marked as skipped`);
  }

  /**
   * Clear skipped version (allow updates again)
   */
  async clearSkippedVersion(): Promise<void> {
    await AsyncStorage.removeItem(this.STORAGE_KEY_SKIPPED_VERSION);
    console.log('✅ Skipped version cleared');
  }
}

export const appUpdateService = new AppUpdateService();

