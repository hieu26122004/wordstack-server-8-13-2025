/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("word_learning_progresses", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    user_saved_word_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "user_saved_words",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    mastery_level: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    correct_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    wrong_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_reviewed_at: {
      allowNull: true,
      type: Sequelize.DATE,
    },
    next_review_at: {
      allowNull: true,
      type: Sequelize.DATE,
    },
    review_interval: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable("word_learning_progresses");
}
