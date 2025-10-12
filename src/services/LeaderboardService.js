import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, increment } from 'firebase/firestore';

export class LeaderboardService {
    constructor(firebase, browserStorage, userId, isLMSUser = false, userContext = {}) {
        this.db = firebase?.db;
        this.browserStorage = browserStorage;
        this.userId = userId;
        this.isLMSUser = isLMSUser;
        this.userContext = userContext; // Store user context
        this.storageKey = 'leaderboard_data';
    }

    // Update user's leaderboard entry when points change
    async updateUserLeaderboard(userData = {}) {
        if (!this.isLMSUser || !this.db || !this.userId) {
            console.log('🎯 Leaderboard: Not an LMS user or no database, skipping leaderboard update');
            return;
        }

        try {
            const leaderboardRef = doc(this.db, 'leaderboard', this.userId);

            // Get current user data to preserve existing fields
            const currentDoc = await getDoc(leaderboardRef);
            const currentData = currentDoc.exists() ? currentDoc.data() : {};

            const now = new Date().toISOString();

            // Get the correct display name with proper fallbacks
            const displayName = await this.getUserDisplayName(userData, currentData);

            await setDoc(leaderboardRef, {
                userId: this.userId,
                displayName: displayName,
                points: userData.points !== undefined ? userData.points : currentData.points || 0,
                totalLessonsCompleted: userData.totalLessonsCompleted !== undefined ? userData.totalLessonsCompleted : currentData.totalLessonsCompleted || 0,
                lastActivity: now,
                ...userData, // Allow overriding any fields
                updatedAt: now
            }, { merge: true });

            console.log('🎯 Leaderboard: Updated user entry for:', displayName);

        } catch (error) {
            console.error('🎯 Leaderboard: Error updating leaderboard:', error);
        }
    }

    // Helper method to get the correct user display name
    async getUserDisplayName(userData = {}, currentData = {}) {
        // Priority 1: Explicitly provided displayName in userData
        if (userData.displayName) {
            return userData.displayName;
        }

        // Priority 2: Existing displayName in current data
        if (currentData.displayName && currentData.displayName !== 'Anonymous Student') {
            return currentData.displayName;
        }

        // Priority 3: Get from user context (Moodle data)
        if (this.userContext?.studentName) {
            return this.userContext.studentName;
        }

        // Priority 4: Get from JWT user data
        if (this.userContext?.user?.full_name) {
            return this.userContext.user.full_name;
        }

        // Priority 5: Try to fetch from user document in Firebase
        try {
            const userRef = doc(this.db, 'users', this.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userDocData = userSnap.data();
                if (userDocData.studentName && userDocData.studentName !== 'Anonymous Student') {
                    return userDocData.studentName;
                }
            }
        } catch (error) {
            console.log('🎯 Leaderboard: Could not fetch user name from Firestore:', error);
        }

        // Final fallback
        return 'Anonymous Student';
    }

    // Get top users for leaderboard
    async getTopUsers(limitCount = 10) {
        if (!this.isLMSUser || !this.db) {
            // For non-LMS users, return mock data or empty array
            return this.getLocalLeaderboard();
        }

        try {
            const leaderboardRef = collection(this.db, 'leaderboard');
            const q = query(leaderboardRef, orderBy('points', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);

            const topUsers = [];
            querySnapshot.forEach((doc) => {
                topUsers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('🎯 Leaderboard: Fetched top users:', topUsers.length);
            return topUsers;

        } catch (error) {
            console.error('🎯 Leaderboard: Error fetching leaderboard:', error);
            return this.getLocalLeaderboard();
        }
    }

    // Get user's current rank
    async getUserRank() {
        if (!this.isLMSUser || !this.db || !this.userId) {
            return null;
        }

        try {
            // This is a simplified approach - for large datasets you'd need a different strategy
            const allUsers = await this.getTopUsers(100); // Get more users to find rank
            const userIndex = allUsers.findIndex(user => user.id === this.userId);

            return userIndex >= 0 ? userIndex + 1 : null;

        } catch (error) {
            console.error('🎯 Leaderboard: Error getting user rank:', error);
            return null;
        }
    }

    // Local storage fallback for non-LMS users
    async getLocalLeaderboard() {
        try {
            const localData = await this.browserStorage.getByKey(this.storageKey);
            return localData || [];
        } catch (error) {
            console.error('🎯 Leaderboard: Error getting local leaderboard:', error);
            return [];
        }
    }

    // Update user display name
    async updateDisplayName(displayName) {
        await this.updateUserLeaderboard({ displayName });
    }

    // Increment lessons completed
    async incrementLessonsCompleted() {
        if (!this.isLMSUser || !this.db || !this.userId) return;

        try {
            const leaderboardRef = doc(this.db, 'leaderboard', this.userId);
            await updateDoc(leaderboardRef, {
                totalLessonsCompleted: increment(1),
                lastActivity: new Date().toISOString()
            });
        } catch (error) {
            console.error('🎯 Leaderboard: Error incrementing lessons completed:', error);
        }
    }
}
