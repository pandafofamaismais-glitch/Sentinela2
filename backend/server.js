// =========================================================
// PROJETO SENTINELA
// BACKEND HOSPITALAR
// =========================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const app = express();

const PORT = 3000;


// =========================================================
// CONFIGURAÇÕES
// =========================================================

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// =========================================================
// FRONTEND
// =========================================================

app.use(
    express.static(
        path.join(__dirname, "../frontend")
    )
);


// =========================================================
// UPLOADS
// =========================================================

const UPLOAD_FOLDER =
    path.join(
        __dirname,
        "uploads"
    );

if (!fs.existsSync(UPLOAD_FOLDER)) {

    fs.mkdirSync(
        UPLOAD_FOLDER,
        {
            recursive: true
        }
    );

}

app.use(
    "/uploads",
    express.static(UPLOAD_FOLDER)
);


// =========================================================
// MULTER
// =========================================================

const storage =
    multer.diskStorage({

        destination:
            (req, file, cb) => {

                cb(
                    null,
                    UPLOAD_FOLDER
                );

            },

        filename:
            (req, file, cb) => {

                const extensao =
                    path.extname(
                        file.originalname
                    );

                const nome =
                    Date.now() +
                    "-" +
                    Math.floor(
                        Math.random() *
                        99999
                    ) +
                    extensao;

                cb(
                    null,
                    nome
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {
            fileSize:
                5 * 1024 * 1024
        },

        fileFilter:
            (req, file, cb) => {

                const permitidos = [
                    "image/png",
                    "image/jpeg",
                    "image/jpg",
                    "image/webp"
                ];

                if (
                    permitidos.includes(
                        file.mimetype
                    )
                ) {

                    cb(
                        null,
                        true
                    );

                } else {

                    cb(
                        new Error(
                            "Formato de imagem inválido."
                        )
                    );

                }

            }

    });


// =========================================================
// BANCO DE DADOS
// =========================================================

const DB_FILE =
    path.join(
        __dirname,
        "db.json"
    );


function criarBanco() {

    if (
        !fs.existsSync(
            DB_FILE
        )
    ) {

        fs.writeFileSync(

            DB_FILE,

            JSON.stringify(

                {

                    usuarios: [],

                    pacientes: [],

                    triagens: [],

                    consultas: [],

                    historico: [],

                    medicamentos: [

                        "Dipirona",

                        "Paracetamol",

                        "Ibuprofeno",

                        "Amoxicilina",

                        "Omeprazol",

                        "Loratadina"

                    ]

                },

                null,

                4

            )

        );

    }

}


criarBanco();


function readDB() {

    const dados =
        fs.readFileSync(
            DB_FILE,
            "utf8"
        );

    const db =
        JSON.parse(
            dados
        );

    db.usuarios =
        db.usuarios || [];

    db.pacientes =
        db.pacientes || [];

    db.triagens =
        db.triagens || [];

    db.consultas =
        db.consultas || [];

    db.historico =
        db.historico || [];

    db.medicamentos =
        db.medicamentos || [];

    return db;

}


function writeDB(
    db
) {

    fs.writeFileSync(

        DB_FILE,

        JSON.stringify(
            db,
            null,
            4
        )

    );

}


// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function gerarProntuario() {

    return uuidv4()
        .replace(
            /-/g,
            ""
        )
        .substring(
            0,
            8
        )
        .toUpperCase();

}


function agora() {

    return new Date()
        .toLocaleString(
            "pt-BR"
        );

}


function normalizarCPF(
    cpf
) {

    return String(
        cpf || ""
    )
        .replace(
            /\D/g,
            ""
        );

}


function registrarHistorico(
    acao,
    usuario
) {

    const db =
        readDB();

    db.historico.push({

        id:
            Date.now(),

        acao:

            acao,

        usuario:
            usuario ||
            "sistema",

        data:
            agora()

    });

    writeDB(
        db
    );

}


// =========================================================
// SEGURANÇA
// =========================================================

async function criarSenha(
    senha
) {

    return await bcrypt.hash(
        senha,
        10
    );

}


function verificarPermissao(
    cargos
) {

    return (
        req,
        res,
        next
    ) => {

        const tipo =
            req.headers.tipo;

        if (
            !tipo ||
            !cargos.includes(
                tipo
            )
        ) {

            return res
                .status(403)
                .json({

                    erro:
                        "Acesso negado para este usuário."

                });

        }

        next();

    };

}


// =========================================================
// ADMINISTRADOR INICIAL
// =========================================================

async function criarAdministradorInicial() {

    const db =
        readDB();

    const existe =
        db.usuarios.find(
            usuario =>
                usuario.usuario ===
                "admin"
        );

    if (!existe) {

        const senha =
            await criarSenha(
                "123"
            );

        db.usuarios.push({

            id:
                Date.now(),

            usuario:
                "admin",

            senha:

                senha,

            tipo:
                "administrador",

            nome:
                "Administrador",

            criadoEm:
                agora()

        });

        writeDB(
            db
        );

        console.log(
            "Administrador inicial criado."
        );

    }

}


// =========================================================
// LOGIN
// =========================================================

app.post(
    "/login",
    async (
        req,
        res
    ) => {

        try {

            const {
                usuario,
                senha
            } = req.body;

            if (
                !usuario ||
                !senha
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Usuário e senha são obrigatórios."

                    });

            }

            const db =
                readDB();

            const encontrado =
                db.usuarios.find(
                    u =>
                        u.usuario ===
                        usuario
                );

            if (!encontrado) {

                return res
                    .status(401)
                    .json({

                        erro:
                            "Usuário ou senha incorretos."

                    });

            }

            let senhaCorreta =
                false;

            if (
                encontrado.senha &&
                encontrado.senha.startsWith(
                    "$2"
                )
            ) {

                senhaCorreta =
                    await bcrypt.compare(
                        senha,
                        encontrado.senha
                    );

            } else {

                senhaCorreta =
                    senha ===
                    encontrado.senha;

            }

            if (!senhaCorreta) {

                return res
                    .status(401)
                    .json({

                        erro:
                            "Usuário ou senha incorretos."

                    });

            }

            registrarHistorico(

                `Login realizado: ${usuario}`,

                usuario

            );

            res.json({

                mensagem:
                    "Login realizado com sucesso.",

                usuario: {

                    id:
                        encontrado.id,

                    usuario:
                        encontrado.usuario,

                    tipo:
                        encontrado.tipo,

                    nome:
                        encontrado.nome

                }

            });

        }

        catch (erro) {

            console.error(
                "ERRO NO LOGIN:",
                erro
            );

            res.status(500)
                .json({

                    erro:
                        "Erro interno no login."

                });

        }

    }
);


// =========================================================
// USUÁRIOS
// =========================================================

app.post(
    "/usuarios",
    verificarPermissao([
        "administrador"
    ]),
    async (
        req,
        res
    ) => {

        try {

            const {
                usuario,
                senha,
                tipo,
                nome
            } = req.body;

            const tiposPermitidos = [

                "administrador",

                "medico",

                "triagem",

                "atendimento",

                "medicacoes"

            ];

            if (
                !usuario ||
                !senha ||
                !tipo ||
                !nome
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Preencha todos os campos."

                    });

            }

            if (
                !tiposPermitidos.includes(
                    tipo
                )
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Tipo de usuário inválido."

                    });

            }

            const db =
                readDB();

            const existe =
                db.usuarios.find(
                    u =>
                        u.usuario ===
                        usuario
                );

            if (existe) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Usuário já existe."

                    });

            }

            const novoUsuario = {

                id:
                    Date.now(),

                usuario,

                senha:
                    await criarSenha(
                        senha
                    ),

                tipo,

                nome,

                criadoEm:
                    agora()

            };

            db.usuarios.push(
                novoUsuario
            );

            writeDB(
                db
            );

            res.status(201)
                .json({

                    mensagem:
                        "Usuário criado com sucesso.",

                    usuario: {

                        id:
                            novoUsuario.id,

                        usuario:
                            novoUsuario.usuario,

                        tipo:
                            novoUsuario.tipo,

                        nome:
                            novoUsuario.nome

                    }

                });

        }

        catch (erro) {

            console.error(
                erro
            );

            res.status(500)
                .json({

                    erro:
                        "Erro ao criar usuário."

                });

        }

    }
);


// =========================================================
// PACIENTES
// =========================================================

// Cadastro inicial
// Somente atendimento

app.post(
    "/recepcao",
    verificarPermissao([
        "administrador",
        "atendimento"
    ]),
    upload.single("foto"),
    (
        req,
        res
    ) => {

        try {

            const db =
                readDB();

            const {
                nome,
                cpf,
                tipo,
                dataNascimento,
                telefone,
                sexo,
                endereco
            } = req.body;

            if (
                !nome ||
                !cpf ||
                !tipo
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Preencha todos os campos obrigatórios."

                    });

            }

            const cpfNormalizado =
                normalizarCPF(
                    cpf
                );

            const existe =
                db.pacientes.find(

                    p =>
                        normalizarCPF(
                            p.cpf
                        ) ===
                        cpfNormalizado

                );

            if (existe) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "CPF já cadastrado."

                    });

            }

            const paciente = {

                id:
                    Date.now(),

                prontuario:
                    gerarProntuario(),

                nome,

                cpf:
                    cpfNormalizado,

                tipo,

                dataNascimento:
                    dataNascimento ||
                    "",

                telefone:
                    telefone ||
                    "",

                sexo:
                    sexo ||
                    "",

                endereco:
                    endereco ||
                    "",

                foto:
                    req.file
                        ? req.file.filename
                        : "",

                status:
                    "aguardando_triagem",

                triagemId:
                    null,

                criadoEm:
                    agora()

            };

            db.pacientes.push(
                paciente
            );

            writeDB(
                db
            );

            registrarHistorico(

                `Paciente cadastrado: ${nome}`,

                req.headers.usuario ||
                "sistema"

            );

            res.status(201)
                .json({

                    mensagem:
                        "Paciente cadastrado com sucesso.",

                    paciente

                });

        }

        catch (erro) {

            console.error(
                erro
            );

            res.status(500)
                .json({

                    erro:
                        "Erro ao cadastrar paciente."

                });

        }

    }
);


// =========================================================
// LISTAR PACIENTES
// SOMENTE ATENDIMENTO
// =========================================================

app.get(
    "/pacientes",
    verificarPermissao([
        "administrador",
        "atendimento"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        res.json(
            db.pacientes
        );

    }
);


// =========================================================
// TRIAGEM
// =========================================================

// A triagem só pode ser acessada pela equipe de triagem.

app.post(
    "/triagem",
    verificarPermissao([
        "administrador",
        "triagem"
    ]),
    (
        req,
        res
    ) => {

        try {

            const db =
                readDB();

            const {
                pacienteId,
                nome,
                sintoma,
                temperatura,
                alergia,
                observacao,
                pressao,
                batimentos,
                saturacao
            } = req.body;

            if (
                !nome ||
                !sintoma
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Informe o nome e o sintoma."

                    });

            }

            let paciente =
                null;

            if (
                pacienteId
            ) {

                paciente =
                    db.pacientes.find(

                        p =>
                            p.id ==
                            pacienteId

                    );

            }

            let temperaturaNumero =
                null;

            if (
                temperatura !==
                undefined &&
                temperatura !== ""
            ) {

                temperaturaNumero =
                    Number(
                        temperatura
                    );

                if (
                    Number.isNaN(
                        temperaturaNumero
                    )
                ) {

                    return res
                        .status(400)
                        .json({

                            erro:
                                "Temperatura inválida."

                        });

                }

            }

            const sintomaNormalizado =
                String(
                    sintoma
                )
                    .toLowerCase()
                    .trim();

            let risco =
                "verde";

            if (
                temperaturaNumero !== null &&
                temperaturaNumero >= 39
            ) {

                risco =
                    "vermelho";

            }

            else if (

                [

                    "infarto",
                    "avc",
                    "hemorragia",
                    "convulsao",
                    "falta_ar_grave"

                ].includes(
                    sintomaNormalizado
                )

            ) {

                risco =
                    "vermelho";

            }

            else if (

                [

                    "febre",
                    "vomito",
                    "diarreia",
                    "falta_ar_moderada"

                ].includes(
                    sintomaNormalizado
                )

            ) {

                risco =
                    "amarelo";

            }

            const triagem = {

                id:
                    Date.now(),

                pacienteId:
                    paciente
                        ? paciente.id
                        : null,

                nome:
                    paciente
                        ? paciente.nome
                        : nome,

                sintoma,

                sintomas:
                    sintoma,

                temperatura:
                    temperaturaNumero,

                alergia:
                    alergia ||
                    "",

                observacao:
                    observacao ||
                    "",

                pressao:
                    pressao ||
                    "",

                frequenciaCardiaca:
                    batimentos ||
                    "",

                saturacao:
                    saturacao ||
                    "",

                risco,

                status:
                    "aguardando_atendimento",

                criadoEm:
                    agora()

            };

            db.triagens.push(
                triagem
            );

            if (
                paciente
            ) {

                paciente.triagemId =
                    triagem.id;

                paciente.status =
                    "aguardando_atendimento";

                paciente.atualizadoEm =
                    agora();

            }

            writeDB(
                db
            );

            registrarHistorico(

                `Triagem realizada: ${triagem.nome} - risco ${risco}`,

                req.headers.usuario ||
                "sistema"

            );

            res.status(201)
                .json({

                    mensagem:
                        "Triagem salva e enviada ao atendimento.",

                    triagem

                });

        }

        catch (erro) {

            console.error(
                erro
            );

            res.status(500)
                .json({

                    erro:
                        "Erro ao salvar triagem."

                });

        }

    }
);


// =========================================================
// FILA DA TRIAGEM
// SOMENTE TRIAGEM
// =========================================================

app.get(
    "/triagem/pacientes",
    verificarPermissao([
        "administrador",
        "triagem"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        const pacientes =
            db.pacientes.filter(

                p =>
                    p.status ===
                    "aguardando_triagem"

            );

        res.json(
            pacientes
        );

    }
);

// =========================================================
// SALVAR TRIAGEM
// =========================================================

app.post(
    "/triagem",

    verificarPermissao([
        "administrador",
        "triagem",
        "enfermeiro"
    ]),

    (
        req,
        res
    ) => {

        try {

            const db =
                readDB();


            if (!db.triagens) {

                db.triagens = [];

            }


            const {

                pacienteId,
                nome,
                sintoma,
                sintomas,
                temperatura,
                alergia,
                observacao,
                observacoes,
                pressao,
                frequenciaCardiaca,
                batimentos,
                saturacao

            } = req.body;


            const sintomaFinal =
                sintoma ||
                sintomas ||
                "";


            if (
                !nome ||
                !sintomaFinal
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Preencha o nome e o sintoma."

                    });

            }


            let paciente =
                null;


            if (
                pacienteId
            ) {

                paciente =
                    db.pacientes.find(

                        p =>
                            p.id ==
                            pacienteId

                    );


                if (!paciente) {

                    return res
                        .status(404)
                        .json({

                            erro:
                                "Paciente não encontrado."

                        });

                }

            }


            let temperaturaNumero =
                null;


            if (
                temperatura !== undefined &&
                temperatura !== ""
            ) {

                temperaturaNumero =
                    Number(
                        temperatura
                    );


                if (
                    Number.isNaN(
                        temperaturaNumero
                    )
                ) {

                    return res
                        .status(400)
                        .json({

                            erro:
                                "Temperatura inválida."

                        });

                }

            }


            const sintomaNormalizado =
                String(
                    sintomaFinal
                )
                .toLowerCase()
                .trim();


            let risco =
                "verde";


            if (
                temperaturaNumero !== null &&
                temperaturaNumero >= 39
            ) {

                risco =
                    "vermelho";

            }


            else if (

                [
                    "infarto",
                    "avc",
                    "hemorragia",
                    "convulsao",
                    "convulsão",
                    "falta_ar_grave"

                ].includes(
                    sintomaNormalizado
                )

            ) {

                risco =
                    "vermelho";

            }


            else if (

                [
                    "febre",
                    "vomito",
                    "vômito",
                    "diarreia",
                    "falta_ar_moderada"

                ].includes(
                    sintomaNormalizado
                )

            ) {

                risco =
                    "amarelo";

            }


            const triagem = {

                id:
                    Date.now(),

                pacienteId:
                    paciente
                        ? paciente.id
                        : null,

                nome:
                    paciente
                        ? paciente.nome
                        : nome,

                sintoma:
                    sintomaFinal,

                sintomas:
                    sintomaFinal,

                temperatura:
                    temperaturaNumero,

                alergia:
                    alergia || "",

                observacao:
                    observacao ||
                    observacoes ||
                    "",

                pressao:
                    pressao || "",

                frequenciaCardiaca:
                    frequenciaCardiaca ||
                    batimentos ||
                    "",

                saturacao:
                    saturacao || "",

                risco:

                    risco,

                // IMPORTANTE:
                // TRIAGEM -> ATENDIMENTO

                status:
                    "aguardando_atendimento",

                criadoEm:
                    agora()

            };


            db.triagens.push(
                triagem
            );


            if (
                paciente
            ) {

                paciente.triagemId =
                    triagem.id;

                paciente.status =
                    "aguardando_atendimento";

                paciente.atualizadoEm =
                    agora();

            }


            writeDB(db);


            registrarHistorico(

                `Triagem realizada: ${triagem.nome} - risco ${risco}`,

                req.headers.usuario ||
                "sistema"

            );


            res
                .status(201)
                .json({

                    mensagem:
                        "Triagem salva e enviada para o atendimento.",

                    triagem

                });


        } catch (erro) {

            console.error(
                "ERRO AO SALVAR TRIAGEM:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao salvar triagem."

                });

        }

    }
);


// =========================================================
// ATENDIMENTO
// =========================================================

// Aqui chega somente o que foi processado pela triagem.

app.get(
    "/atendimento",
    verificarPermissao([
        "administrador",
        "atendimento"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        const fila =
            db.triagens

                .filter(

                    t =>
                        t.status ===
                        "aguardando_atendimento"

                )

                .map(

                    triagem => {

                        const paciente =
                            db.pacientes.find(

                                p =>
                                    p.id ==
                                    triagem.pacienteId

                            );

                        return {

                            ...triagem,

                            paciente:
                                paciente ||
                                null

                        };

                    }

                )

                .sort(

                    (
                        a,
                        b
                    ) =>
                        a.id -
                        b.id

                );

        res.json(
            fila
        );

    }
);


// =========================================================
// CONCLUIR ATENDIMENTO
// ENVIA PARA O MÉDICO
// =========================================================

app.post(
    "/atendimento",
    verificarPermissao([
        "administrador",
        "atendimento"
    ]),
    upload.single("foto"),
    (
        req,
        res
    ) => {

        try {

            const db =
                readDB();

            const {
                triagemId,
                nome,
                cpf,
                tipo,
                dataNascimento,
                telefone,
                sexo,
                endereco
            } = req.body;

            let triagem =
                null;

            if (
                triagemId
            ) {

                triagem =
                    db.triagens.find(

                        t =>
                            t.id ==
                            triagemId

                    );

            }

            if (!triagem) {

                triagem =
                    db.triagens.find(

                        t =>

                            t.status ===
                            "aguardando_atendimento" &&

                            String(
                                t.nome
                            )
                                .toLowerCase()
                                .trim() ===

                            String(
                                nome
                            )
                                .toLowerCase()
                                .trim()

                    );

            }

            if (!triagem) {

                return res
                    .status(404)
                    .json({

                        erro:
                            "Triagem não encontrada."

                    });

            }

            if (
                triagem.status !==
                "aguardando_atendimento"
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Esta triagem já foi processada."

                    });

            }

            if (
                !cpf
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Informe o CPF."

                    });

            }

            const cpfNormalizado =
                normalizarCPF(
                    cpf
                );

            let paciente =
                db.pacientes.find(

                    p =>
                        normalizarCPF(
                            p.cpf
                        ) ===
                        cpfNormalizado

                );

            if (
                paciente
            ) {

                paciente.nome =
                    nome ||
                    paciente.nome;

                paciente.tipo =
                    tipo ||
                    paciente.tipo;

                paciente.dataNascimento =
                    dataNascimento ||
                    paciente.dataNascimento;

                paciente.telefone =
                    telefone ||
                    paciente.telefone;

                paciente.sexo =
                    sexo ||
                    paciente.sexo;

                paciente.endereco =
                    endereco ||
                    paciente.endereco;

                if (
                    req.file
                ) {

                    paciente.foto =
                        req.file.filename;

                }

                paciente.triagemId =
                    triagem.id;

                paciente.status =
                    "aguardando_medico";

                paciente.atualizadoEm =
                    agora();

            }

            else {

                paciente = {

                    id:
                        Date.now(),

                    prontuario:
                        gerarProntuario(),

                    nome:
                        nome ||
                        triagem.nome,

                    cpf:
                        cpfNormalizado,

                    tipo:
                        tipo ||
                        "normal",

                    dataNascimento:
                        dataNascimento ||
                        "",

                    telefone:
                        telefone ||
                        "",

                    sexo:
                        sexo ||
                        "",

                    endereco:
                        endereco ||
                        "",

                    foto:
                        req.file
                            ? req.file.filename
                            : "",

                    status:
                        "aguardando_medico",

                    triagemId:
                        triagem.id,

                    criadoEm:
                        agora()

                };

                db.pacientes.push(
                    paciente
                );

            }

            triagem.pacienteId =
                paciente.id;

            triagem.nome =
                paciente.nome;

            triagem.status =
                "aguardando_medico";

            triagem.enviadoAoMedicoEm =
                agora();

            writeDB(
                db
            );

            registrarHistorico(

                `Atendimento concluído: ${paciente.nome} enviado ao médico`,

                req.headers.usuario ||
                "sistema"

            );

            res.status(201)
                .json({

                    mensagem:
                        "Atendimento concluído. Paciente enviado ao médico.",

                    paciente,

                    triagem

                });

        }

        catch (erro) {

            console.error(
                erro
            );

            res.status(500)
                .json({

                    erro:
                        "Erro ao concluir atendimento."

                });

        }

    }
);


// =========================================================
// FILA MÉDICA
// SOMENTE MÉDICO E ADMINISTRADOR
// =========================================================

app.get(
    "/fila-medica",

    verificarPermissao([
        "administrador",
        "medico"
    ]),

    (
        req,
        res
    ) => {

        try {

            const db =
                readDB();


            const fila =
                db.pacientes

                    .filter(

                        paciente =>
                            paciente.status ===
                            "aguardando_medico"

                    )

                    .map(

                        paciente => {

                            const triagem =
                                db.triagens.find(

                                    t =>
                                        t.id ==
                                        paciente.triagemId

                                ) || null;


                            return {

                                ...paciente,

                                triagem,

                                sintomas:
                                    triagem
                                        ? (
                                            triagem.sintomas ||
                                            triagem.sintoma ||
                                            ""
                                        )
                                        : "",

                                temperatura:
                                    triagem
                                        ? triagem.temperatura
                                        : null,

                                alergia:
                                    triagem
                                        ? triagem.alergia
                                        : "",

                                observacao:
                                    triagem
                                        ? triagem.observacao
                                        : "",

                                risco:
                                    triagem
                                        ? triagem.risco
                                        : ""

                            };

                        }

                    )

                    .sort(

                        (
                            a,
                            b
                        ) =>
                            a.id -
                            b.id

                    );


            res.json(
                fila
            );


        } catch (erro) {

            console.error(
                "ERRO NA FILA MÉDICA:",
                erro
            );


            res
                .status(500)
                .json({

                    erro:
                        "Erro ao carregar fila médica."

                });

        }

    }
);

// =========================================================
// CONSULTA MÉDICA
// SOMENTE MÉDICO
// =========================================================

app.post(
    "/consulta",
    verificarPermissao([
        "administrador",
        "medico"
    ]),
    (
        req,
        res
    ) => {

        try {

            const db =
                readDB();

            const {
                pacienteId,
                triagemId,
                paciente: nomePaciente,
                diagnostico,
                medicacao,
                obs
            } = req.body;

            if (
                !diagnostico ||
                !medicacao
            ) {

                return res
                    .status(400)
                    .json({

                        erro:
                            "Diagnóstico e medicação são obrigatórios."

                    });

            }

            let paciente =
                null;

            if (
                pacienteId
            ) {

                paciente =
                    db.pacientes.find(

                        p =>
                            p.id ==
                            pacienteId

                    );

            }

            if (
                !paciente &&
                nomePaciente
            ) {

                paciente =
                    db.pacientes.find(

                        p =>
                            p.nome ===
                            nomePaciente

                    );

            }

            if (!paciente) {

                return res
                    .status(404)
                    .json({

                        erro:
                            "Paciente não encontrado."

                    });

            }

            let triagem =
                null;

            if (
                triagemId
            ) {

                triagem =
                    db.triagens.find(

                        t =>
                            t.id ==
                            triagemId

                    );

            }

            if (
                !triagem &&
                paciente.triagemId
            ) {

                triagem =
                    db.triagens.find(

                        t =>
                            t.id ==
                            paciente.triagemId

                    );

            }

            const consulta = {

                id:
                    Date.now(),

                pacienteId:
                    paciente.id,

                paciente:
                    paciente.nome,

                prontuario:
                    paciente.prontuario,

                triagemId:
                    triagem
                        ? triagem.id
                        : null,

                diagnostico,

                medicacao,

                obs:
                    obs ||
                    "",

                medico:
                    req.headers.usuario ||
                    "sistema",

                criadoEm:
                    agora()

            };

            db.consultas.push(
                consulta
            );

            if (
                triagem
            ) {

                triagem.status =
                    "atendido";

                triagem.atendidoEm =
                    agora();

            }

            paciente.status =
                "atendido";

            paciente.atualizadoEm =
                agora();

            writeDB(
                db
            );

            registrarHistorico(

                `Consulta registrada: ${paciente.nome}`,

                req.headers.usuario ||
                "sistema"

            );

            res.status(201)
                .json({

                    mensagem:
                        "Consulta salva com sucesso.",

                    consulta

                });

        }

        catch (erro) {

            console.error(
                erro
            );

            res.status(500)
                .json({

                    erro:
                        "Erro ao salvar consulta."

                });

        }

    }
);


// =========================================================
// MEDICAÇÕES
// SOMENTE MEDICAMENTOS E MÉDICO
// =========================================================

app.get(
    "/lista-medicacoes",
    verificarPermissao([
        "administrador",
        "medico",
        "medicacoes"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        res.json(
            db.medicamentos
        );

    }
);


// =========================================================
// PRESCRIÇÕES
// MEDICAMENTOS
// =========================================================

app.get(
    "/medicacoes",
    verificarPermissao([
        "administrador",
        "medicacoes"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        const consultas =
            db.consultas || [];

        res.json(
            consultas
        );

    }
);


// =========================================================
// HISTÓRICO
// SOMENTE ADMINISTRADOR
// =========================================================

app.get(
    "/historico",
    verificarPermissao([
        "administrador"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        res.json(
            db.historico
        );

    }
);


app.delete(
    "/historico",
    verificarPermissao([
        "administrador"
    ]),
    (
        req,
        res
    ) => {

        const db =
            readDB();

        db.historico =
            [];

        writeDB(
            db
        );

        res.json({

            mensagem:
                "Histórico limpo com sucesso."

        });

    }
);


// =========================================================
// ROTA NÃO ENCONTRADA
// =========================================================

app.use(
    (
        req,
        res
    ) => {

        res.status(404)
            .json({

                erro:
                    "Rota não encontrada."

            });

    }
);


// =========================================================
// ERROS DO MULTER
// =========================================================

app.use(

    (
        err,
        req,
        res,
        next
    ) => {

        if (
            err instanceof
            multer.MulterError
        ) {

            return res
                .status(400)
                .json({

                    erro:
                        err.message

                });

        }

        if (
            err
        ) {

            return res
                .status(400)
                .json({

                    erro:
                        err.message

                });

        }

        next();

    }

);


// =========================================================
// INICIAR SERVIDOR
// =========================================================

async function iniciarServidor() {

    try {

        await criarAdministradorInicial();

        app.listen(
            PORT,
            () => {

                console.log("");
                console.log(
                    "========================================"
                );
                console.log(
                    "🏥 PROJETO SENTINELA"
                );
                console.log(
                    "Servidor iniciado com sucesso!"
                );
                console.log(
                    "http://localhost:" +
                    PORT
                );
                console.log(
                    "========================================"
                );
                console.log("");

            }
        );

    }

    catch (erro) {

        console.error(
            "ERRO AO INICIAR SERVIDOR:",
            erro
        );

    }

}

iniciarServidor();

// =========================================================
// PROJETO SENTINELA
// JS GERAL
// =========================================================

const API =
    "http://localhost:3000";


// =========================================================
// USUÁRIO LOGADO
// =========================================================

function obterUsuario() {

    try {

        const dados =
            localStorage.getItem(
                "usuario"
            );

        if (!dados) {
            return null;
        }

        return JSON.parse(
            dados
        );

    }

    catch (erro) {

        console.error(
            erro
        );

        return null;

    }

}


// =========================================================
// VERIFICAR ACESSO À PÁGINA
// =========================================================

function protegerPagina(
    cargosPermitidos
) {

    const usuario =
        obterUsuario();

    if (!usuario) {

        window.location.href =
            "index.html";

        return false;

    }

    if (
        !cargosPermitidos.includes(
            usuario.tipo
        )
    ) {

        alert(
            "Você não possui permissão para acessar esta área."
        );

        redirecionarUsuario(
            usuario.tipo
        );

        return false;

    }

    return true;

}


// =========================================================
// REDIRECIONAMENTO
// =========================================================

function redirecionarUsuario(
    tipo
) {

    switch (
        tipo
    ) {

        case "triagem":

            window.location.href =
                "triagem.html";

            break;


        case "atendimento":

            window.location.href =
                "atendimento.html";

            break;


        case "medico":

            window.location.href =
                "medico.html";

            break;


        case "medicacoes":

            window.location.href =
                "medicacoes.html";

            break;


        case "administrador":

            window.location.href =
                "atendimento.html";

            break;


        default:

            localStorage.removeItem(
                "usuario"
            );

            window.location.href =
                "index.html";

            break;

    }

}


// =========================================================
// FETCH PROTEGIDO
// =========================================================

async function apiFetch(
    rota,
    opcoes = {}
) {

    const usuario =
        obterUsuario();

    if (!usuario) {

        window.location.href =
            "index.html";

        throw new Error(
            "Usuário não autenticado."
        );

    }

    const headers =
        opcoes.headers || {};

    headers.tipo =
        usuario.tipo;

    headers.usuario =
        usuario.usuario;

    const resposta =
        await fetch(

            API +
            rota,

            {

                ...opcoes,

                headers

            }

        );

    let dados;

    try {

        dados =
            await resposta.json();

    }

    catch (erro) {

        dados = {};

    }

    if (
        !resposta.ok
    ) {

        throw new Error(

            dados.erro ||
            "Erro na comunicação com o servidor."

        );

    }

    return dados;

}


// =========================================================
// SAIR
// =========================================================

function sair() {

    localStorage.removeItem(
        "usuario"
    );

    window.location.href =
        "index.html";

}


// =========================================================
// ESCONDER LINKS QUE O USUÁRIO NÃO PODE USAR
// =========================================================

function configurarMenu() {

    const usuario =
        obterUsuario();

    if (!usuario) {
        return;
    }

    const links =
        document.querySelectorAll(
            ".menu a"
        );

    links.forEach(
        link => {

            const destino =
                link
                    .getAttribute(
                        "href"
                    );

            if (
                usuario.tipo ===
                "administrador"
            ) {

                return;

            }

            if (
                usuario.tipo ===
                "triagem" &&
                destino !==
                "triagem.html"
            ) {

                link.style.display =
                    "none";

            }

            if (
                usuario.tipo ===
                "atendimento" &&
                destino !==
                "atendimento.html"
            ) {

                link.style.display =
                    "none";

            }

            if (
                usuario.tipo ===
                "medico" &&
                destino !==
                "medico.html"
            ) {

                link.style.display =
                    "none";

            }

            if (
                usuario.tipo ===
                "medicacoes" &&
                destino !==
                "medicacoes.html"
            ) {

                link.style.display =
                    "none";

            }

        }
    );

}


// =========================================================
// MOSTRAR USUÁRIO
// =========================================================

function mostrarUsuario() {

    const usuario =
        obterUsuario();

    const elementos =
        document.querySelectorAll(
            ".usuario"
        );

    if (!usuario) {
        return;
    }

    elementos.forEach(
        elemento => {

            elemento.textContent =
                usuario.nome ||
                usuario.usuario;

        }
    );

}

app.listen(
    PORT,
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "🏥 PROJETO SENTINELA"
        );

        console.log(
            "Servidor iniciado com sucesso!"
        );

        console.log(
            "🌐 http://localhost:" +
            PORT
        );

        console.log(
            "========================================"
        );

    }
);
