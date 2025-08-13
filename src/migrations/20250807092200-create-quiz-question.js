/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("quiz_questions", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    quiz_session_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "quiz_sessions",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    word_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "words",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    question_type: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    question_text: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    correct_answer: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    user_answer: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    options: {
      type: Sequelize.JSONB,
      allowNull: true,
    },
    is_correct: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
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
  await queryInterface.dropTable("quiz_questions");
}
