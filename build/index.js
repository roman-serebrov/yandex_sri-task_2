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
const getEntityBySprint = (type, sprint, field = 'timestamp') => entity => entity.type === type && entity[field] >= sprint.startAt && entity[field] <= sprint.finishAt;

const getCommitsBySprint = (entities, sprint, withDetails = true) => entities.filter(getEntityBySprint('Commit', sprint)).map(commit => {
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

function prepareData(entities, { sprintId }) {

    const currentSprint = getEntityById(entities, 'Sprint', sprintId);

    if (!currentSprint) {
        return [];
    }

    const title = `Спринт № ${currentSprint.id}`;
    const previousSprint = getEntityById(entities, 'Sprint', sprintId - 1);
    const commitsBySprint = getEntitiesByType(entities, 'Sprint').map(sprint => {
        const sprintCommits = {
            title: String(sprint.id),
            value: getCommitsBySprint(entities, sprint, false).length
        };
        if (sprint.id === currentSprint.id) {
            sprintCommits.active = true;
        }
        return sprintCommits;
    });
    
    const commits = getCommitsBySprint(entities, currentSprint);
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
                subtitle: title,
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
                    let lineBase = 'голос';
                    const ending = user.valueText % 10;
                    if ([2, 3, 4].includes(ending)) {
                        lineBase += 'а';
                    } else if ([5, 6, 7, 8, 9, 0].includes(ending)) {
                        lineBase += 'ов';
                    }
                    user.valueText = `${user.valueText} ${lineBase}`;
                    return user;
                }),
            }
        },
        {
            alias: "leaders",
            data: {
                title: "Больше всего коммитов",
                subtitle: title,
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
              subtitle: title,
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
              subtitle: title,
              totalText: "182 коммита",
              differenceText: "+42 с прошлого спринта",
              categories: [
                {"title": "> 1001 строки", "valueText": "30 коммитов", "differenceText": "+8 коммитов"},
                {"title": "501 — 1000 строк", "valueText": "32 коммита", "differenceText": "+6 коммитов"},
                {"title": "101 — 500 строк", "valueText": "58 коммитов", "differenceText": "+16 коммитов"},
                {"title": "1 — 100 строк", "valueText": "62 коммита", "differenceText": "+12 коммитов"}
              ]
            }
          }
    ];
}

module.exports = { prepareData }