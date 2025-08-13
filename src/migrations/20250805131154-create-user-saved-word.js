/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("user_saved_words", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
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
    notes: {
      type: Sequelize.TEXT,
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

  await queryInterface.sequelize.query(`
    ALTER TABLE "user_saved_words"
    ADD CONSTRAINT user_word_unique UNIQUE ("word_id", "user_id");
  `);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
    ALTER TABLE "user_saved_words"
    DROP CONSTRAINT IF EXISTS user_word_unique;
  `);

  await queryInterface.dropTable("user_saved_words");
}
