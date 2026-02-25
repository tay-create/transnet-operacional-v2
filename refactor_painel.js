const fs = require('fs');
let content = fs.readFileSync('src/components/PainelOperacional.js', 'utf8');

// 1. Add imports at the top
if (!content.includes("import ModalImagem")) {
    content = content.replace("import ModalOcorrencia from './ModalOcorrencia';",
        "import ModalOcorrencia from './ModalOcorrencia';\nimport ModalImagem from './ModalImagem';\nimport ModalColetas from './ModalColetas';");
}


// 2. Replace the ModalImagem
const modalImagemRegex = /\{\/\* Modal de Visualização de Imagem Ampliada \*\/\}\s*\{\s*imagemAmpliada && \([\s\S]*?(?=\{\/\* Modal de Coletas Embutido \*\/)/;
content = content.replace(modalImagemRegex,
    `{/* Modal de Visualização de Imagem Ampliada */}
            <ModalImagem imagemAmpliada={imagemAmpliada} setImagemAmpliada={setImagemAmpliada} />

            `);

// 3. Replace the ModalColetas
const modalColetasRegex = /\{\/\* Modal de Coletas Embutido \*\/\}\s*\{modalColetasAberto && veiculoSelecionado && \([\s\S]*?(?=\{\/\* Modal de Checklist Embutido \*\/\})/
content = content.replace(modalColetasRegex,
    `{/* Modal de Coletas Embutido */}
            <ModalColetas 
                veiculoSelecionado={veiculoSelecionado} 
                setModalColetasAberto={setModalColetasAberto} 
                setVeiculoSelecionado={setVeiculoSelecionado} 
                updateList={updateList} 
                podeEditarNaUnidade={podeEditarNaUnidade} 
            />

            `);

fs.writeFileSync('src/components/PainelOperacional.js', content);
console.log('PainelOperacional refactored successfully!');
