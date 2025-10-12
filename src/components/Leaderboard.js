import React, { useState, useEffect } from 'react';
import { withStyles } from '@material-ui/core/styles';
import {
    Card,
    CardContent,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    CircularProgress,
    Button
} from '@material-ui/core';
import {
    EmojiEvents,
    Star,
    Whatshot,
    Person
} from '@material-ui/icons';

const styles = (theme) => ({
    card: {
        margin: theme.spacing(2),
        maxWidth: 400,
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing(2),
    },
    list: {
        maxHeight: 400,
        overflow: 'auto',
    },
    listItem: {
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
    rank1: {
        backgroundColor: '#fff9c4',
    },
    rank2: {
        backgroundColor: '#f5f5f5',
    },
    rank3: {
        backgroundColor: '#ffccbc',
    },
    userRank: {
        backgroundColor: '#e3f2fd',
        borderLeft: `4px solid ${theme.palette.primary.main}`,
    },
    points: {
        fontWeight: 'bold',
        color: theme.palette.primary.main,
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        padding: theme.spacing(3),
    },
});

const Leaderboard = ({ classes, leaderboardService, currentUserId, onClose, firebase }) => {
    const [topUsers, setTopUsers] = useState([]);
    const [userRank, setUserRank] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userNames, setUserNames] = useState({}); // Cache for user names

    // Function to fetch user name from Firebase
    const fetchUserName = async (userId) => {
        if (!firebase?.db) return 'Anonymous Student';

        try {
            const userRef = doc(firebase.db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                return userData.studentName || 'Anonymous Student';
            }
            return 'Anonymous Student';
        } catch (error) {
            console.error('Error fetching user name:', error);
            return 'Anonymous Student';
        }
    };

    // Function to enhance user data with names from Firebase
    const enhanceUsersWithNames = async (users) => {
        const enhancedUsers = await Promise.all(
            users.map(async (user) => {
                // If user already has a displayName, use it
                if (user.displayName && user.displayName !== 'Anonymous Student') {
                    return user;
                }

                // Otherwise fetch from Firebase
                const userName = await fetchUserName(user.id);
                return {
                    ...user,
                    displayName: userName
                };
            })
        );
        return enhancedUsers;
    };

    const loadLeaderboard = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [users, rank] = await Promise.all([
                leaderboardService.getTopUsers(10),
                leaderboardService.getUserRank()
            ]);

            // Enhance users with names from Firebase
            const enhancedUsers = await enhanceUsersWithNames(users);

            setTopUsers(enhancedUsers);
            setUserRank(rank);

        } catch (error) {
            console.error('Error loading leaderboard:', error);
            setError('Failed to load leaderboard');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLeaderboard();

        const interval = setInterval(loadLeaderboard, 30000);
        return () => clearInterval(interval);
    }, [leaderboardService, firebase]);

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return <EmojiEvents style={{ color: '#FFD700' }} />;
            case 2: return <Star style={{ color: '#C0C0C0' }} />;
            case 3: return <Whatshot style={{ color: '#CD7F32' }} />;
            default: return <Person />;
        }
    };

    const getRankClass = (rank, userId) => {
        if (userId === currentUserId) return classes.userRank;
        switch (rank) {
            case 1: return classes.rank1;
            case 2: return classes.rank2;
            case 3: return classes.rank3;
            default: return '';
        }
    };

    if (error) {
        return (
            <Card className={classes.card}>
                <CardContent>
                    <Typography color="error" align="center">
                        {error}
                    </Typography>
                    <Button
                        fullWidth
                        onClick={loadLeaderboard}
                        style={{ marginTop: 16 }}
                    >
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    console.debug(topUsers);

    return (
        <Card className={classes.card}>
            <CardContent>
                <Typography variant="h6" className={classes.title}>
                    🏆 Leaderboard
                </Typography>

                {isLoading ? (
                    <div className={classes.loadingContainer}>
                        <CircularProgress />
                    </div>
                ) : (
                    <>
                        <List className={classes.list}>
                            {topUsers.map((user, index) => (
                                <ListItem
                                    key={user.id}
                                    className={`${classes.listItem} ${getRankClass(index + 1, user.id)}`}
                                >
                                    <ListItemIcon>
                                        {getRankIcon(index + 1)}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography
                                                variant="body1"
                                                style={{
                                                    fontWeight: user.id === currentUserId ? 'bold' : 'normal'
                                                }}
                                            >
                                                {user.displayName || 'Anonymous Student'}
                                                {user.id === currentUserId && ' (You)'}
                                            </Typography>
                                        }
                                        secondary={
                                            <Typography variant="body2" color="textSecondary">
                                                {user.points || 0} points •
                                                {user.totalLessonsCompleted || 0} lessons
                                            </Typography>
                                        }
                                    />
                                    <Typography style={{ marginLeft: "10px" }} variant="h6" className={classes.points}>
                                        #{index + 1}
                                    </Typography>
                                </ListItem>
                            ))}
                        </List>

                        {userRank && userRank > 10 && (
                            <Typography variant="body2" color="textSecondary" align="center" style={{ marginTop: 16 }}>
                                Your rank: #{userRank}
                            </Typography>
                        )}

                        <Button
                            fullWidth
                            onClick={loadLeaderboard}
                            style={{ marginTop: 16 }}
                        >
                            Refresh
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default withStyles(styles)(Leaderboard);
