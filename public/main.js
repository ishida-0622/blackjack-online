let db = {};
document.addEventListener("DOMContentLoaded", () => db = firebase.database());



const suits = ["spade", "heart", "dia", "club", "dummy"];
const mark = { "spade": "♠", "heart": "♥", "dia": "♦", "club": "♣", "dummy": "X" };
const numbers = {
    1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
    8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 999: "X"
};

class Card {
    constructor(suit, num) {
        this.suit = suit;
        this.num = num;
        this.html = `<div class="card ${this.suit}"><p>${mark[this.suit]}<br>${numbers[this.num]}</p></div>`;
    }
}

function createId() {
    return String(Math.random()).substring(2, 6);
}

const vue = new Vue({
    el: "#main",
    data: {
        id: "",
        roomId: "",
        isHost: false,
        cards: [],
        deck: [],
        myCardHTML: "",
        opponentCardHTML: "",
        oneFlag: false,
        point: [0, 0],
        myWin: 0,
        opponentWin: 0,
        draw: 0,
        result: "",
        winLose: "",
        ref: {},
        sync: {
            hostId: "",
            guestId: "",
            hostStand: false,
            guestStand: false,
            hostPoint: 0,
            guestPoint: 0,
            timestamp: "",
            drawnCards: [new Card(suits[4], 999), new Card(suits[1], 9)],
        },
    },
    methods: {
        start: function () {
            this.winLose = `${this.myWin}勝${this.opponentWin}敗${this.draw}分`;
            $("#tmp").remove();
            $("#start").remove();
            this.drawCard(2);
        },
        createRoom: async function () {
            if ($("#inputRoomId").val() === "") {
                alert("Room IDを入力してください")
                return;
            }
            this.roomId = $("#inputRoomId").val();
            this.id = createId();
            this.sync.hostId = this.id;
            this.ref = db.ref(`/room/${this.roomId}`);
            const snapshot = await this.ref.once("value");
            if (snapshot.val()) {
                alert("すでに部屋が存在します");
                return;
            }
            this.isHost = true;
            $("#inputRoomId").remove();
            $("#create").remove();
            $("#go").remove();
            $("h1").remove();
            this.sync.timestamp = new Date().toLocaleString("ja");
            this.ref.set(this.sync);
            this.stay();
        },
        goRoom: async function () {
            if ($("#inputRoomId").val() === "") {
                alert("Room IDを入力してください")
                return;
            }
            this.roomId = $("#inputRoomId").val();
            this.ref = db.ref(`/room/${this.roomId}`);
            const snapshot = await this.ref.once("value");
            if (!snapshot.val()) {
                alert("部屋が存在しません");
                return;
            }
            this.sync = snapshot.val();
            console.log(this.sync);
            if (this.sync.guestId != "") {
                alert("満員です");
                return;
            }
            let cnt = 0;
            while (true) {
                this.id = createId();
                if (this.id === this.sync.hostId && cnt < 100) {
                    cnt++;
                    continue;
                }
                break;
            }
            if (cnt >= 100) {
                alert("混雑しています\n時間をおいて再度試してください");
                return;
            }
            this.sync.guestId = this.id;
            this.ref.set(this.sync);
            this.setPush();
            $("#inputRoomId").remove();
            $("#create").remove();
            $("#go").remove();
            $("h1").remove();
            this.stay();
        },
        stay: function () {
            if (this.isHost) {
                $("#roomId").append(`<p id='tmp'>ゲストが来るまでお待ちください</p>`);
            } else {
                $("#roomId").append(`<p id='tmp'>準備ができたらStartをクリック</p><a href="javascript:void(0);" class="btn btn-border" id="start">Start</a>`);
            }
            this.initGame();
        },
        setPush: function (gameSetFlag = false) {
            this.ref.on("value", function (snapshot) {
                this.sync = snapshot.val();
                console.log("up date!");
                console.log(this.sync);
            })
            if (gameSetFlag) {
                this.gameSet();
            }
        },
        cardsUpdate: function(){
            ;
        },
        initGame: async function () {
            this.cards = [];
            this.myCardHTML = "";
            this.deck = [];
            this.opponentCardHTML = "";
            this.oneFlag = false;
            this.point = [0, 0];
            this.result = "";
            this.sync.drawnCards = [new Card(suits[4], 999)];
            this.sync.hostStand = false;
            this.sync.guestStand = false;
            this.ref = db.ref(`/room/${this.roomId}`);
            this.ref.set(this.sync);
            this.setPush();
            this.cardSet();
        },
        gameSet: function () {
            if (this.sync.hostStand && this.sync.guestStand) {
                this.judge();
            }
        },
        judge: function () {
            const h = this.sync.hostPoint;
            const g = this.sync.guestPoint;
            if (h === g || (h > 21 && g > 21)) {
                this.result = "Draw";
                this.draw++;
            } else if (g > 21 || (h > g && h <= 21)) {
                if (this.isHost) {
                    this.result = "Win!";
                    this.myWin++;
                } else {
                    this.result = "Lose...";
                    this.opponentWin++;
                }
            } else {
                if (this.isHost) {
                    this.result = "Lose...";
                    this.opponentWin++;
                } else {
                    this.result = "Win!";
                    this.myWin++;
                }
            }
        },
        cardSet: function () {
            for (let i = 0; i < 4; i++) {
                for (let j = 1; j <= 13; j++) {
                    let card = new Card(suits[i], j);
                    this.cards.push(card);
                }
            }
        },
        drawCard: function (num = 1) {
            this.setPush();
            for (let i = 0; i < num; i++) {
                let rdm;
                let card = this.cards[0];
                let flg;
                while (true) {
                    rdm = Math.floor(Math.random() * this.cards.length);
                    card = this.cards[rdm];
                    flg = false;
                    for (let i = 0; i < this.sync.drawnCards.length; i++) {
                        console.log(this.sync.drawnCards[i]["html"]);
                        console.log(card);
                        if (card["html"] === this.sync.drawnCards[i]["html"]) {
                            flg = true;
                            break;
                        }
                    }
                    if (flg) {
                        continue;
                    }
                    break;
                }
                this.deck.push(card);
                this.myCardHTML += card["html"];
                this.sync.drawnCards.push(card);
                this.ref = db.ref(`/room/${this.roomId}`);
                this.ref.set(this.sync);
            }
        },
        pointPlus: function (num) {
            if (num === 1) {
                if (this.oneFlag) {
                    this.point[0] += 1;
                    this.point[1] += 1;
                } else {
                    this.point[0] += 1;
                    this.point[1] += 11;
                    this.oneFlag = true;
                }
            } else if (num >= 10) {
                this.point[0] += 10;
                this.point[1] += 10;
            } else {
                this.point[0] += num;
                this.point[1] += num;
            }
        }
    }
})

$("body").on("click", "#start", function () {
    vue.start();
})