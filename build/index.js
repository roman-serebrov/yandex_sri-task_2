// TODO: перед отправкой закомментировать
// const input = require('../input');

const groupByField = (arr, field) => arr.reduce((acc, item) => {
    const fieldValue = item[field];
    if (!acc[fieldValue]) {
        acc[fieldValue] = [];
    }
    acc[fieldValue].push(item);
    return acc;
}, {});

const getEntitiesByType = (entities, type) => entities.filter(entity => entity.type === type);
const getEntityById = (entities, type, id) => entities.find(entity => entity.type === type && entity.id === id);
const getEntityByTime = (type, start, end, field = 'timestamp') => entity => entity.type === type && entity[field] >= start && entity[field] <= end;
const getEntityBySprint = (type, sprint, field = 'timestamp') => getEntityByTime(type, sprint.startAt, sprint.finishAt, field);

const getCommitsBySprint = (entities, sprint, withDetails = true) => !sprint ? [] : entities.filter(getEntityBySprint('Commit', sprint)).map(commit => {
    if (withDetails) {
        commit.summaries = commit.summaries.map(summaryId => {
            const summary = getEntityById(entities, 'Summary', summaryId);
            summary.comments = summary.comments.map(commentId => {
                return getEntityById(entities, 'Comment', commentId);
            });
            return summary;
        });
    }
    return commit;
});

const getCommitsByDay = (commitDates, day) => commitDates.filter(commitDate => commitDate.getDay() === day).reduce((acc, commitDate) => {
    acc[commitDate.getHours()]++;
    return acc;
}, new Array(24).fill(0));

const lines1001 = '> 1001 строки';
const lines1000 = '501 — 1000 строк';
const lines500 = '101 — 500 строк';
const lines100 = '1 — 100 строк';

const getCommitLinesStat = (commits) => {
    const commitStats = {
        [lines1001]: 0,
        [lines1000]: 0,
        [lines500]: 0,
        [lines100]: 0,
    };
    commits.forEach(commit => {
        const commitLines = commit.summaries.reduce((lines, summary) => lines + summary.added + summary.removed, 0);
        if (commitLines > 1000) {
            commitStats[lines1001]++;
        } else if (commitLines > 500 && commitLines <= 1000) {
            commitStats[lines1000]++;
        } else if (commitLines > 100 && commitLines <= 500) {
            commitStats[lines500]++;
        } else {
            commitStats[lines100]++;
        }
    });
    return {
        total: commits.length,
        stats: commitStats,
    };
};

const pluralize = (base, variants) => {
    variants = Object.keys(variants).reduce((acc, key) => {
        variants[key].forEach(value => {
            acc[value] = key;
        });
        return acc;
    }, new Array(10).fill(''));

    return (value, wrap = v => v) => `${wrap(value)} ${base + variants[Math.abs(value) % 10]}`;
}
const signWrapper = value => value > 0 ? `+${value}` : value;
const defaultVariants = {
    'a': [2, 3, 4],
    'ов': [5, 6, 7, 8, 9, 0],
};
const pluralizeVotes = pluralize('голос', defaultVariants);
const pluralizeCommits = pluralize('коммит', defaultVariants);

function prepareData(entities, { sprintId }) {

    const currentSprint = getEntityById(entities, 'Sprint', sprintId);

    if (!currentSprint) {
        return [];
    }

    const previousSprint = getEntityById(entities, 'Sprint', sprintId - 1);
    const commitsBySprint = getEntitiesByType(entities, 'Sprint').sort((a, b) => a.id - b.id).map(sprint => {
        const sprintCommits = {
            title: String(sprint.id),
            value: getCommitsBySprint(entities, sprint, false).length
        };
        if (sprint.id === currentSprint.id) {
            sprintCommits.active = true;
        }
        return sprintCommits;
    });
    const prevSprintCommits = getCommitsBySprint(entities, previousSprint);
    const commits = getCommitsBySprint(entities, currentSprint);
    const commitDates = commits.map(commit => new Date(commit.timestamp));
    const currentSprintCommitStats = getCommitLinesStat(commits);
    const prevSprintCommitStats = getCommitLinesStat(prevSprintCommits);
    const commitsByAuthor = groupByField(commits, 'author');
    const userIds = new Set(Object.keys(commitsByAuthor).map(Number));
    const users = entities.filter(entity => entity.type === 'User' && userIds.has(entity.id)).map(user => {
        return {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
        };
    });
    const leaders = users.map(user => {
        return {
            ...user,
            valueText: commitsByAuthor[user.id].length,
        }
    }).sort((a, b) => b.valueText - a.valueText);

    return [
        {
            alias: "vote",
            data: {
                title: "Самый 🔎 внимательный разработчик",
                subtitle: currentSprint.name,
                emoji: "🔎",
                users: users.map(user => {
                    return {
                        ...user,
                        valueText: commitsByAuthor[user.id].reduce((acc, commit) => {
                            const linesNumber = commit.summaries.reduce((likes, summary) => likes + summary.comments.reduce((commentLikes, comment) => {
                                return commentLikes + comment.likes.length;
                            }, 0), 0);
                            return acc + linesNumber;
                        }, 0),
                    }
                }).sort((a, b) => b.valueText - a.valueText).map(user => {
                    user.valueText = pluralizeVotes(user.valueText);
                    return user;
                }),
            }
        },
        {
            alias: "leaders",
            data: {
                title: "Больше всего коммитов",
                subtitle: currentSprint.name,
                emoji: "👑",
                users: leaders.slice(0, 5).map(user => {
                    user.valueText = String(user.valueText)
                    return user;
                }),
            }
        },
        {
            alias: "chart",
            data: {
                title: "Коммиты",
                subtitle: currentSprint.name,
                values: commitsBySprint,
                users: leaders.slice(0, 3).map(user => {
                    user.valueText = String(user.valueText)
                    return user;
                }),
            }
        },
        {
            alias: "diagram",
            data: {
                title: "Размер коммитов",
                subtitle: currentSprint.name,
                totalText: pluralizeCommits(currentSprintCommitStats.total),
                differenceText: `${signWrapper(currentSprintCommitStats.total - prevSprintCommitStats.total)} с прошлого спринта`,
                categories: [lines1001, lines1000, lines500, lines100].map(title => {
                    const difference = currentSprintCommitStats.stats[title] - prevSprintCommitStats.stats[title];
                    return {
                        title,
                        valueText: pluralizeCommits(currentSprintCommitStats.stats[title]),
                        differenceText: pluralizeCommits(difference, signWrapper)
                    };
                }),
            }
        },
        {
            alias: "activity",
            data: {
                title: "Коммиты, 1 неделя",
                subtitle: currentSprint.name,
                data: {
                    mon: getCommitsByDay(commitDates, 1),
                    tue: getCommitsByDay(commitDates, 2),
                    wed: getCommitsByDay(commitDates, 3),
                    thu: getCommitsByDay(commitDates, 4),
                    fri: getCommitsByDay(commitDates, 5),
                    sat: getCommitsByDay(commitDates, 6),
                    sun: getCommitsByDay(commitDates, 0),
                },
            }
        }
    ];
}

// TODO: перед отправкой закомментировать
// console.log(JSON.stringify(prepareData(input, { sprintId: 961 })));

module.exports = { prepareData };
