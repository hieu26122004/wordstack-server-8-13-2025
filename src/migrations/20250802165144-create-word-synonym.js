/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("word_synonyms", {
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
    synonymy_id: {
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
  ALTER TABLE "word_synonyms"
  ADD CONSTRAINT word_syn_unique UNIQUE ("word_id", "synonymy_id");
`);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
  ALTER TABLE "word_synonyms"
  DROP CONSTRAINT IF EXISTS word_syn_unique;
`);
  await queryInterface.dropTable("word_synonyms");
}
