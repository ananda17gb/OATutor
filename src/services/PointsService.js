import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { LeaderboardService } from "./LeaderboardService"

export class PointsService {
    constructor(firebase, browserStorage, userId, isLMSUser = false) {
        this.db = firebase?.db;
        this.browserStorage = browserStorage;
        this.userId = userId;
        this.isLMSUser = isLMSUser;
        this.storageKey = 'user_points_data';
        this.problemAttempts = new Map();

        // Simple session tracking
        this.sessionPoints = 0; // Points earned in current session (not persisted yet)
        this.totalPoints = 0;   // Total points (persisted + session)
        this.totalLessonsCompleted = 0;
        this.onPointsUpdate = null; // Callback for UI updates

        // Initialize leaderboard service
        this.leaderboardService = new LeaderboardService(firebase, browserStorage, userId, isLMSUser);
    }

    // Initialize user points data
    async initializeUserData() {
        if (this.isLMSUser && this.db) {
            try {
                const userRef = doc(this.db, 'users', this.userId);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    // Use setDoc instead of updateDoc for initial creation
                    await setDoc(userRef, {
                        points: 0,
                        totalLessonsCompleted: 0,
                        badges: [],
                    });
                } else {
                    // Ensure required fields exist in existing document
                    const userData = userDoc.data();
                    const updates = {};

                    if (userData.points === undefined) {
                        updates.points = 0;
                    }
                    if (userData.totalLessonsCompleted === undefined) {
                        updates.totalLessonsCompleted = 0;
                    }
                    if (userData.badges === undefined) {
                        updates.badges = [];
                    }

                    if (Object.keys(updates).length > 0) {
                        await updateDoc(userRef, updates);
                        console.log('🎯 Updated existing user document with missing fields:', updates);
                    }

                    // Load current values
                    this.totalLessonsCompleted = userData.totalLessonsCompleted || 0;
                }
            } catch (error) {
                console.error('Error initializing Firebase user data:', error);
            }
        } else {
            try {
                const existingData = await this.browserStorage.getByKey(this.storageKey);
                if (!existingData) {
                    await this.browserStorage.setByKey(this.storageKey, {
                        points: 0,
                        totalLessonsCompleted: 0,
                        badges: [],
                        lastUpdated: new Date().toISOString()
                    });
                } else {
                    // Ensure required fields exist in local storage
                    if (existingData.totalLessonsCompleted === undefined) {
                        existingData.totalLessonsCompleted = 0;
                        await this.browserStorage.setByKey(this.storageKey, existingData);
                    }
                    this.totalLessonsCompleted = existingData.totalLessonsCompleted || 0;
                }
            } catch (error) {
                console.error('Error initializing local storage user data:', error);
            }
        }

        // Load current points
        await this.loadCurrentPoints();
    }

    // Load current points from storage
    async loadCurrentPoints() {
        try {
            let persistedPoints = 0;
            let persistedLessonCompleted = 0;

            if (this.isLMSUser && this.db) {
                const userRef = doc(this.db, 'users', this.userId);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    persistedPoints = userData.points || 0;
                    persistedLessonCompleted = userData.totalLessonsCompleted || 0;
                }
            } else {
                const data = await this.browserStorage.getByKey(this.storageKey);
                persistedPoints = data?.points || 0;
                persistedLessonCompleted = data?.totalLessonsCompleted || 0;
            }

            this.totalPoints = persistedPoints;
            this.totalLessonsCompleted = persistedLessonCompleted;
            this.sessionPoints = 0;
            this.notifyPointsUpdate();

        } catch (error) {
            console.error('Error loading points:', error);
            this.totalPoints = 0;
            this.totalLessonsCompleted = 0;
            this.sessionPoints = 0;
            this.notifyPointsUpdate();
            return 0;
        }
    }

    // Unified points awarding - accumulates but doesn't persist
    awardPoints(isCorrect, context = {}) {
        if (!isCorrect) {
            return 0;
        }

        const {
            knowledgeComponents = [],
            attemptCount = 1,
            lessonProgress = 0,
            isLessonCompletion = false
        } = context;

        let pointsEarned = 0;

        if (isLessonCompletion) {
            // Lesson completion points
            pointsEarned = 100;
            const masteryPercentage = context.masteryPercentage || 0;

            if (masteryPercentage >= 90) {
                pointsEarned += 50;
            } else if (masteryPercentage >= 70) {
                pointsEarned += 25;
            }

            this.incrementLessonsCompleted();
        } else {
            // Problem completion points
            pointsEarned = 10;
            const complexityBonus = Math.min(knowledgeComponents.length * 3, 15);
            pointsEarned += complexityBonus;

            if (attemptCount === 1) {
                pointsEarned += 8;
            }

            if (lessonProgress > 0.7) {
                pointsEarned += 10;
            }

            pointsEarned = Math.min(pointsEarned, 35);
        }

        // Accumulate in session
        this.sessionPoints += pointsEarned;
        this.totalPoints += pointsEarned;

        // Update UI immediately
        this.notifyPointsUpdate();

        console.log('🎯 Points awarded:', {
            pointsEarned,
            sessionPoints: this.sessionPoints,
            totalPoints: this.totalPoints,
            type: isLessonCompletion ? 'lesson' : 'problem'
        });

        return pointsEarned;
    }

    // Persist all accumulated points (call this when lesson is completed or next problem is clicked)
    async persistAccumulatedPoints() {
        if (this.sessionPoints === 0) {
            return 0;
        }

        const pointsToPersist = this.sessionPoints;
        console.log('🎯 Persisting points:', pointsToPersist);

        try {
            if (this.isLMSUser && this.db) {
                const userRef = doc(this.db, 'users', this.userId);
                await updateDoc(userRef, {
                    points: increment(pointsToPersist)
                });
                // Update leaderboard with new total points
                const newTotalPoints = this.totalPoints;
                await this.leaderboardService.updateUserLeaderboard({
                    points: newTotalPoints,
                    totalLessonsCompleted: this.totalLessonsCompleted
                });
            } else {
                const currentData = await this.browserStorage.getByKey(this.storageKey) || {
                    points: 0,
                    totalLessonsCompleted: 0,
                    badges: []
                };
                const newPoints = (currentData.points || 0) + pointsToPersist;

                await this.browserStorage.setByKey(this.storageKey, {
                    ...currentData,
                    points: newPoints,
                    totalLessonsCompleted: this.totalLessonsCompleted,
                    lastUpdated: new Date().toISOString()
                });
            }

            // Reset session points after successful persistence
            this.sessionPoints = 0;
            console.log('🎯 Points persisted successfully');
            return pointsToPersist;

        } catch (error) {
            console.error('🎯 Error persisting points:', error);
            return 0;
        }
    }

    // Increment lessons completed and update both user doc and leaderboard
    async incrementLessonsCompleted() {
        console.log('🎯 Incrementing lessons completed...');

        if (this.isLMSUser && this.db) {
            try {
                const userRef = doc(this.db, 'users', this.userId);
                await updateDoc(userRef, {
                    totalLessonsCompleted: increment(1)
                });

                // Update local counter
                this.totalLessonsCompleted += 1;

                // Update leaderboard
                await this.leaderboardService.updateUserLeaderboard({
                    totalLessonsCompleted: this.totalLessonsCompleted
                });

                console.log('🎯 Lessons completed incremented to:', this.totalLessonsCompleted);
                return this.totalLessonsCompleted;

            } catch (error) {
                console.error('Error incrementing lessons completed:', error);
                return this.totalLessonsCompleted;
            }
        } else {
            // Local storage
            try {
                const currentData = await this.browserStorage.getByKey(this.storageKey) || {
                    points: 0,
                    totalLessonsCompleted: 0,
                    badges: []
                };
                const newLessonsCompleted = (currentData.totalLessonsCompleted || 0) + 1;

                await this.browserStorage.setByKey(this.storageKey, {
                    ...currentData,
                    totalLessonsCompleted: newLessonsCompleted,
                    lastUpdated: new Date().toISOString()
                });

                this.totalLessonsCompleted = newLessonsCompleted;
                console.log('🎯 Lessons completed incremented to:', this.totalLessonsCompleted);
                return this.totalLessonsCompleted;

            } catch (error) {
                console.error('Error incrementing lessons completed in local storage:', error);
                return this.totalLessonsCompleted;
            }
        }
    }

    // Get current total lessons completed
    getTotalLessonsCompleted() {
        return this.totalLessonsCompleted;
    }

    // Reset session points (if user leaves without saving)
    resetSessionPoints() {
        const lostPoints = this.sessionPoints;
        this.totalPoints -= this.sessionPoints;
        this.sessionPoints = 0;
        this.notifyPointsUpdate();
        return lostPoints;
    }

    // Get current total points (persisted + session)
    getCurrentPoints() {
        return this.totalPoints;
    }

    // Get session points (not yet persisted)
    getSessionPoints() {
        return this.sessionPoints;
    }

    // Track problem attempts
    trackProblemAttempt(problemId) {
        const currentAttempts = this.problemAttempts.get(problemId) || 0;
        this.problemAttempts.set(problemId, currentAttempts + 1);
        return currentAttempts + 1;
    }

    // Set callback for UI updates
    setPointsUpdateCallback(callback) {
        this.onPointsUpdate = callback;
    }

    // Notify UI of points changes
    notifyPointsUpdate() {
        if (this.onPointsUpdate) {
            this.onPointsUpdate(this.totalPoints);
        }
    }

    // Backward compatibility methods
    async awardProblemCompletion(isCorrect, problemContext = {}) {
        return this.awardPoints(isCorrect, problemContext);
    }

    async awardLessonCompletion(masteryPercentage) {
        return this.awardPoints(true, {
            isLessonCompletion: true,
            masteryPercentage: masteryPercentage
        });
    }

    // Check if user is a LMS user
    static isLMSUser(additionalContext) {
        return !!(additionalContext?.firebaseToken || additionalContext?.jwt);
    }
}
