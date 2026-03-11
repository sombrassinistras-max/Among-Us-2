let CONFIG = {
    cameraZoom: 4, playerSize: 20, hitboxRadius: 5, playerSpeed: 2,
    spawnX: 606, spawnY: 104, myRole: "IMPOSTOR", ventRule: "RESTRICTED"
};

const tasks =[
    { id: "med_scan", room: "MedBay", name: "Fazer o Scan", type: "SCAN", x: 462.6, y: 290.3, completed: false },
    { id: "sec_down", room: "Security", name: "Download", type: "DOWNLOAD", x: 147.3, y: 369, completed: false },
    { id: "elec_calib", room: "Electrical", name: "Calibrar", type: "CALIBRATE", x: 197.3, y: 454.3, completed: false },
    { id: "elec_wires", room: "Electrical", name: "Fios Elétricos", type: "WIRES", x: 405.3, y: 341, completed: false },
    { id: "stor_fuel", room: "Storage", name: "Encher Galão", type: "FUEL", x: 561.3, y: 485, completed: false },
    { id: "stor_trash", room: "Storage", name: "Esvaziar o Lixo", type: "TRASH", x: 596.6, y: 619.6, completed: false },
    { id: "admin_card", room: "Admin", name: "Passar o Cartão", type: "SWIPE", x: 750.6, y: 373.6, completed: false },
    { id: "admin_down", room: "Admin", name: "Download", type: "DOWNLOAD", x: 145.3, y: 210.3, completed: false },
    { id: "nav_align", room: "Navigation", name: "Alinhar Curso", type: "ALIGN", x: 558, y: 665.6, completed: false },
    { id: "o2_filter", room: "O2", name: "Limpar Filtro", type: "LEAVES", x: 742, y: 69.6, completed: false },
    { id: "o2_trash", room: "O2", name: "Esvaziar Lixo", type: "TRASH", x: 642.6, y: 551.6, completed: false },
    { id: "weap_aster", room: "Weapons", name: "Atirar Asteroides", type: "ASTEROIDS", x: 830, y: 137, completed: false },
    { id: "weap_down", room: "Weapons", name: "Download", type: "DOWNLOAD", x: 733.3, y: 562.3, completed: false }
];

let ventsData =[
    { id: "vent_0", x: 721.25, y: 183.125, links: ["vent_1"] },
    { id: "vent_1", x: 822.25, y: 104.875, links:[] },
    { id: "vent_2", x: 836.5, y: 322.25, links: ["vent_3"] },
    { id: "vent_3", x: 986.5, y: 320.25, links:[] },
    { id: "vent_4", x: 986.25, y: 248.25, links: ["vent_5"] },
    { id: "vent_5", x: 841.25, y: 499.875, links:[] },
    { id: "vent_6", x: 683.25, y: 399, links: ["vent_7"] },
    { id: "vent_7", x: 405.25, y: 357.75, links:[] },
    { id: "vent_8", x: 282, y: 483.375, links:["vent_9"] },
    { id: "vent_9", x: 343.75, y: 333.875, links:[] },
    { id: "vent_10", x: 157.5, y: 333.5, links:["vent_11"] },
    { id: "vent_11", x: 281, y: 120.25, links:[] },
    { id: "vent_12", x: 132.5, y: 245.625, links:["vent_13"] },
    { id: "vent_13", x: 387, y: 271.625, links:[] }
];

// Transforma os dutos em Ida e Volta
ventsData.forEach(v => {
    v.links.forEach(linkId => {
        let target = ventsData.find(t => t.id === linkId);
        if (target && !target.links.includes(v.id)) target.links.push(v.id);
    });
});