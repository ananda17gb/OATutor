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
        this.totalProblemsCompleted = 0;
        this.onPointsUpdate = null; // Callback for UI updates

        // Initialize leaderboard service
        this.leaderboardService = new LeaderboardService(firebase, browserStorage, userId, isLMSUser);

        this.badgeDefinitions = {
            FIRST_PROBLEM: {
                id: 'first_problem',
                name: 'First Step',
                description: 'Complete your first problem',
                criteria: (userData) => userData.totalProblemsCompleted >= 1,
                icon: '🚀'
            },
            // QUICK_LEARNER: {
            //     id: 'quick_learner',
            //     name: 'Quick Learner',
            //     description: 'Complete a problem on first attempt',
            //     criteria: (userData) => userData.firstAttemptCompletions >= 5,
            //     icon: '⚡'
            // },
            LESSON_MASTER: {
                id: 'lesson_master',
                name: 'Lesson Master',
                description: 'Complete 5 lessons',
                criteria: (userData) => userData.totalLessonsCompleted >= 5,
                icon: '🎓'
            },
            // PERFECTIONIST: {
            //     id: 'perfectionist',
            //     name: 'Perfectionist',
            //     description: 'Achieve 90% or higher mastery on a lesson',
            //     criteria: (userData) => userData.highMasteryCompletions >= 1,
            //     icon: '⭐'
            // },
            PROBLEM_SOLVER: {
                id: 'problem_solver',
                name: 'Problem Solver',
                description: 'Complete 50 problems',
                criteria: (userData) => userData.totalProblemsCompleted >= 50,
                icon: '💡'
            },
        };
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
                        totalProblemsCompleted: 0,
                        badges: [],
                    });
                } else {
                    // Ensure required fields exist in existing document
                    const userData = userDoc.data();
                    const updates = {};

                    if (userData.points === undefined) updates.points = 0;
                    if (userData.totalLessonsCompleted === undefined) updates.totalLessonsCompleted = 0;
                    if (userData.totalProblemsCompleted === undefined) updates.totalProblemsCompleted = 0;
                    if (userData.badges === undefined) updates.badges = [];

                    if (Object.keys(updates).length > 0) {
                        await updateDoc(userRef, updates);
                        console.log('🎯 Updated existing user document with missing fields:', updates);
                    }

                    // Load current values
                    this.totalLessonsCompleted = userData.totalLessonsCompleted || 0;
                    this.totalProblemsCompleted = userData.totalProblemsCompleted || 0;
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
                        totalProblemsCompleted: 0,
                        badges: [],
                        lastUpdated: new Date().toISOString()
                    });
                } else {
                    // Ensure required fields exist in local storage
                    if (existingData.totalLessonsCompleted === undefined) {
                        existingData.totalLessonsCompleted = 0;
                    }
                    if (existingData.totalProblemsCompleted === undefined) {
                        existingData.totalProblemsCompleted = 0;
                    }
                    await this.browserStorage.setByKey(this.storageKey, existingData);
                    this.totalLessonsCompleted = existingData.totalLessonsCompleted || 0;
                    this.totalProblemsCompleted = existingData.totalProblemsCompleted || 0;
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
            let persistedLessonsCompleted = 0;
            let persistedProblemsCompleted = 0;

            if (this.isLMSUser && this.db) {
                const userRef = doc(this.db, 'users', this.userId);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    persistedPoints = userData.points || 0;
                    persistedLessonsCompleted = userData.totalLessonsCompleted || 0;
                    persistedProblemsCompleted = userData.totalProblemsCompleted || 0;
                }
            } else {
                const data = await this.browserStorage.getByKey(this.storageKey);
                persistedPoints = data?.points || 0;
                persistedLessonsCompleted = data?.totalLessonsCompleted || 0;
                persistedProblemsCompleted = data?.totalProblemsCompleted || 0;
            }

            this.totalPoints = persistedPoints;
            this.totalLessonsCompleted = persistedLessonsCompleted;
            this.totalProblemsCompleted = persistedProblemsCompleted;
            this.sessionPoints = 0;
            this.notifyPointsUpdate();

        } catch (error) {
            console.error('Error loading points:', error);
            this.totalPoints = 0;
            this.totalLessonsCompleted = 0;
            this.totalProblemsCompleted = 0;
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
            isLessonCompletion = false,
        } = context;

        let pointsEarned = 0;

        // this.totalProblemsCompleted += 1;

        // if (attemptCount === 1) this.userStats.firstAttemptCompletions += 1;

        if (isLessonCompletion) {
            // Lesson completion points
            pointsEarned = 100;
            const masteryPercentage = context.masteryPercentage || 0;

            if (masteryPercentage >= 90) {
                pointsEarned += 50;
                // this.highMasteryCompletions += 1;
            } else if (masteryPercentage >= 70) {
                pointsEarned += 25;
            }

            this.incrementLessonsCompleted();
            // this.totalLessonsCompleted += 1;
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

        this.checkAndAwardBadges();

        console.log('🎯 Notifying UI of points update:', this.totalPoints);
        // Update UI immediately
        this.notifyPointsUpdate();

        console.log('🎯 Points awarded:', {
            pointsEarned,
            sessionPoints: this.sessionPoints,
            totalPoints: this.totalPoints,
            totalProblemsCompleted: this.totalProblemsCompleted,
            type: isLessonCompletion ? 'lesson' : 'problem'
        });

        return pointsEarned;
    }

    // Check and award badges
    async checkAndAwardBadges() {
        const earnedBadges = [];

        const userData = {
            totalLessonsCompleted: this.totalLessonsCompleted + (this.sessionLessonsCompleted || 0),
            totalProblemsCompleted: this.totalProblemsCompleted + (this.sessionProblemsCompleted || 0),
        }

        // Check each badge criteria
        Object.values(this.badgeDefinitions).forEach(badge => {
            if (badge.criteria(userData)) {
                earnedBadges.push({
                    id: badge.id,
                    name: badge.name,
                    description: badge.description,
                    icon: badge.icon,
                    earnedAt: new Date().toISOString()
                });
            }
        });

        // Award new badges
        if (earnedBadges.length > 0) {
            await this.awardBadges(earnedBadges);
        }
    }

    // Award badges to user
    async awardBadges(newBadges) {
        if (this.isLMSUser && this.db) {
            try {
                const userRef = doc(this.db, 'users', this.userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const currentBadges = userData.badges || [];

                    // Filter out badges already earned
                    const badgesToAdd = newBadges.filter(newBadge =>
                        !currentBadges.some(existingBadge => existingBadge.id === newBadge.id)
                    );

                    if (badgesToAdd.length > 0) {
                        await updateDoc(userRef, {
                            badges: [...currentBadges, ...badgesToAdd],
                            totalProblemsCompleted: this.totalProblemsCompleted,
                            totalLessonsCompleted: this.totalLessonsCompleted
                        });

                        console.log('🎯 Awarded new badges:', badgesToAdd);
                        this.notifyBadgesUpdate(badgesToAdd);
                    }
                }
            } catch (error) {
                console.error('Error awarding badges:', error);
            }
        }
        // else {
        //     // Local storage implementation
        //     // Similar pattern for local storage
        // }
    }

    // Badge update callback
    setBadgeUpdateCallback(callback) {
        this.onBadgeUpdate = callback;
    }

    notifyBadgesUpdate(newBadges) {
        if (this.onBadgeUpdate) {
            this.onBadgeUpdate(newBadges);
        }
        this.notifyPointsUpdate();
    }

    async getEarnedBadges() {
        try {
            if (this.isLMSUser && this.db) {
                const userRef = doc(this.db, 'users', this.userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    return userData.badges || [];
                }
            }
            return [];
            // else {
            //     // Local storage
            //     // const data = await this.browserStorage.getByKey(this.storageKey);
            //     // return data?.badges || [];
            // }
        } catch (error) {
            console.error('Error loading badges:', error);
            return [];
        }
    }

    // Persist all accumulated points (call this when lesson is completed or next problem is clicked)
    async persistAccumulatedPoints() {
        if (this.sessionPoints === 0 && (this.sessionProblemsCompleted || 0) === 0 && (this.sessionLessonsCompleted || 0) === 0) {
            return 0;
        }

        const pointsToPersist = this.sessionPoints;
        const problemsToPersist = this.sessionProblemsCompleted || 0;
        const lessonsToPersist = this.sessionLessonsCompleted || 0;
        console.log('🎯 Persisting points:', { pointsToPersist, problemsToPersist, lessonsToPersist });

        try {
            if (this.isLMSUser && this.db) {
                const userRef = doc(this.db, 'users', this.userId);
                await updateDoc(userRef, {
                    points: increment(pointsToPersist),
                    totalProblemsCompleted: increment(problemsToPersist),
                    totalLessonsCompleted: increment(lessonsToPersist)
                });

                this.totalProblemsCompleted += problemsToPersist;
                this.totalLessonsCompleted += lessonsToPersist;

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
                    totalProblemsCompleted: 0,
                    badges: []
                };

                const newPoints = (currentData.points || 0) + pointsToPersist;
                const newProblemsCompleted = (currentData.totalProblemsCompleted || 0) + problemsToPersist;
                const newLessonsCompleted = (currentData.totalLessonsCompleted || 0) + lessonsToPersist;

                await this.browserStorage.setByKey(this.storageKey, {
                    ...currentData,
                    points: newPoints,
                    totalLessonsCompleted: newProblemsCompleted,
                    totalProblemsCompleted: newLessonsCompleted,
                    lastUpdated: new Date().toISOString()
                });
                this.totalProblemsCompleted = newProblemsCompleted;
                this.totalLessonsCompleted = newLessonsCompleted;
            }

            // Reset session points after successful persistence
            this.sessionPoints = 0;
            this.sessionProblemsCompleted = 0;
            this.sessionLessonsCompleted = 0;
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

    // Track problem completion for badges (frontend only)
    trackProblemCompletion(isCorrect, context = {}) {
        if (!isCorrect) {
            return;
        }

        const { problemId, isLessonCompletion = false } = context;

        // Increment counters in session only
        if (isLessonCompletion) {
            this.sessionLessonsCompleted = (this.sessionLessonsCompleted || 0) + 1;
        } else {
            this.sessionProblemsCompleted = (this.sessionProblemsCompleted || 0) + 1;
        }

        console.log('🎯 Tracked problem completion for badges (session only):', {
            sessionProblemsCompleted: this.sessionProblemsCompleted,
            sessionLessonsCompleted: this.sessionLessonsCompleted
        });

        // Check badges with session data
        this.checkAndAwardBadges();
    }

    getCurrentProgress() {
        return {
            totalPoints: this.totalPoints,
            sessionPoints: this.sessionPoints,
            totalProblemsCompleted: this.totalProblemsCompleted,
            sessionProblemsCompleted: this.sessionProblemsCompleted || 0,
            totalLessonsCompleted: this.totalLessonsCompleted,
            sessionLessonsCompleted: this.sessionLessonsCompleted || 0
        };
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

    // Get current total problems completed
    getTotalProblemsCompleted() {
        return this.totalProblemsCompleted;
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
        console.log('🎯 PointsService: Setting points update callback', {
            callbackExists: !!callback,
            currentCallback: this.onPointsUpdate,
            callbackType: typeof callback
        });
        this.onPointsUpdate = callback;
    }

    // Notify UI of points changes
    notifyPointsUpdate() {
        console.log('🎯 PointsService: Notifying UI update', {
            callbackExists: !!this.onPointsUpdate,
            totalPoints: this.totalPoints,
            callbackType: typeof this.onPointsUpdate
        });

        if (this.onPointsUpdate) {
            console.log('🎯 PointsService: Calling callback with:', this.totalPoints);
            try {
                this.onPointsUpdate(this.totalPoints);
            } catch (error) {
                console.error('🎯 PointsService: Error in callback:', error);
            }
        } else {
            console.warn('🎯 PointsService: No callback set!');
        }
        // if (this.onPointsUpdate) {
        //     this.onPointsUpdate(this.totalPoints);
        //     // this.onPointsUpdate(this.getCurrentProgress());
        // }
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
