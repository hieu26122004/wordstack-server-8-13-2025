/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("word_antonyms", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
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
    antonym_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "words",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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
  ALTER TABLE "word_antonyms"
  ADD CONSTRAINT word_ant_unique UNIQUE ("word_id", "antonym_id");
`);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
    ALTER TABLE "word_antonyms"
    DROP CONSTRAINT IF EXISTS word_ant_unique;
  `);

  await queryInterface.dropTable("word_antonyms");
}
