/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("word_examples", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    example_text: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    translation: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    word_definition_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "word_definitions",
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
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable("word_examples");
}
