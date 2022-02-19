//@ishida-0622
// 参考1 : https://qiita.com/miso_develop/items/c2061519bb458e22f7d3
// 参考2 : https://github.com/miso-develop/ox-game/blob/master/public/ox.js
// 完全なローカル環境だと動きません localhostを建てるか https://black-jack-515b0.web.app にアクセスしてください


let db = firebase.database(); // DB定義

// スートとマークと数字 DBの仕様上nullを入れると消えるのでダミー用あり
const suits = ["spade", "heart", "dia", "club", "dummy"];
const mark = { "spade": "♠", "heart": "♥", "dia": "♦", "club": "♣", "dummy": "X" };
const numbers = {
    1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
    8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 999: "X"
};

/**
 * カードオブジェクト スート,数字,HTML要素を持つ
 */
class Card {
    constructor(suit, num) {
        this.suit = suit;
        this.num = num;
        this.html = `<div class="card ${this.suit}"><p>${mark[this.suit]}<br>${numbers[this.num]}</p></div>`;
    }
}

/**
 * ID生成
 * @returns 4桁のランダムな数字
 */
function createId() {
    return String(Math.random()).substring(2, 6);
}

const vue = new Vue({
    el: "#main",
    data: {
        id: "", // プレイヤーのID
        roomId: "", // 部屋のID 好きに決められる
        isHost: false, // ホストならtrue
        cards: [], // カードの山
        deck: [], // 手札
        myCardHTML: "", // 手札のHTML要素
        oppCardHTML: "", // 相手の手札のHTML要素
        oneFlag: false, // Aが出ていたらtrue
        point: [0, 0], // Aは1と11で数えるため要素数2
        result: "", // 勝敗結果
        selectHTML: "", // Hit,StandなどのボタンのHTML要素
        drawFlag: true, // DBの仕様上二重に動くことがあるのでそれ用
        ref: {}, // DB更新用
        sync: { // DB内部と同じ要素を持つ この変数を使って更新したり同期したりする
            hostId: "",
            guestId: "",
            hostCards: [new Card(suits[4], 999)], // ホストのカード nullを入れるとDBに保存できないのでダミー
            guestCards: [new Card(suits[4], 999)], // ゲストのカード
            hostStand: false, // ホストがスタンド(カードを引くのをやめること)したか
            guestStand: false, // ゲストがスタンドしたか
            hostPoint: 0,
            guestPoint: 0,
            startFlag: false, // trueになるとゲーム開始処理が行われる
            timestamp: "",
            drawnCards: [new Card(suits[4], 999)], // すでに引かれたカード ダミー
            endFlag: false // trueになると部屋が消える処理が行われる
        },
        githubURL: "https://github.com/ishida-0622/BlackJack_Online", // 点数稼ぎ用
        genba: "genba.jpg" // 点数稼ぎ用
    },
    methods: {
        /**
         * ルーム作成
         */
        createRoom: async function () {
            if ($("#inputRoomId").val() === "") { // ID入力欄が空だったら終了
                alert("Room IDを入力してください");
                return;
            }
            this.roomId = $("#inputRoomId").val(); // 部屋ID取得
            this.id = createId(); // ID取得
            this.sync.hostId = this.id; // ホストID設定
            this.ref = db.ref(`/room/${this.roomId}`); // DB情報取得
            const snapshot = await this.ref.once("value"); // DB情報取得
            if (snapshot.val()) { // 同じ部屋IDが存在していたら終了
                alert("そのIDは使われています");
                return;
            }
            this.isHost = true;
            $("#inputRoomId").remove(); // 不要なDOMの削除
            $("#create").remove();
            $("#go").remove();
            $("h1").remove();
            this.sync.timestamp = new Date().toLocaleString("ja"); // タイムスタンプ更新
            this.ref.set(this.sync); // DB更新
            this.stay(); // 待機画面
            this.setPush(); // ローカル情報更新
        },

        /**
         * ルーム入室
         */
        goRoom: async function () {
            if ($("#inputRoomId").val() === "") { // ID入力欄が空だったら終了
                alert("Room IDを入力してください");
                return;
            }
            this.roomId = $("#inputRoomId").val(); // 部屋ID取得
            this.ref = db.ref(`/room/${this.roomId}`); // DB情報取得
            const snapshot = await this.ref.once("value"); // DB情報取得
            if (!snapshot.val()) { // 部屋IDが存在していなかったら終了
                alert("部屋が存在しません");
                return;
            }
            this.sync = snapshot.val(); // ローカルに反映
            if (this.sync.guestId != "") { // すでにゲストが存在していたら終了
                alert("満員です");
                return;
            }
            let cnt = 0;
            while (true) {
                this.id = createId(); // ID取得
                if (this.id === this.sync.hostId && cnt < 100) { // ホストと被っていたら再取得
                    cnt++;
                    continue;
                }
                break;
            }
            if (cnt >= 100) { // 100回被ったらエラー(1000^100分の1)
                alert("混雑しています\n時間をおいて再度試してください");
                return;
            }
            this.sync.guestId = this.id; // ゲストID設定
            this.ref.set(this.sync); // DB更新
            $("#inputRoomId").remove(); // 不要なDOMの削除
            $("#create").remove();
            $("#go").remove();
            $("h1").remove();
            this.stay(); // 待機画面
            this.setPush(); // ローカル情報更新
        },

        /**
         * 待機画面
         */
        stay: function () {
            if (this.isHost) {
                $("#roomId").append(`<p id='tmp'>準備ができたらStartをクリック</p><a href="javascript:void(0);" class="btn btn-border" id="start">Start</a>`);
            } else {
                $("#roomId").append(`<p id='tmp'>ホストが開始するまでお待ちください</p>`);
            }
            this.genba = "";
            this.githubURL = "";
            $("#github").text("");
        },

        /**
         * ゲーム開始
         */
        start: function () {
            this.setPush(); // ローカル情報更新
            if (this.sync.guestId === "") { // ゲストがいなかったら終了
                alert("ゲストが来ていません");
                return;
            }
            this.sync.startFlag = true;
            this.dbSet(); // DB更新
        },

        /**
         * ゲーム開始
         */
        continueGame: async function () {
            this.sync.startFlag = true;
            this.dbSet(); // DB更新
        },

        /**
         * ゲーム終了
         */
        endGame: function () {
            this.sync.endFlag = true;
            this.dbSet(); // DB更新
        },

        /**
         * ローカル情報の更新 & DB更新時の処理
         */
        setPush: function () {
            this.ref.on("value", async function (snapshot) { // DBが更新された時に実行される処理
                vue.sync = snapshot.val(); // ローカル情報更新
                if (vue.sync.endFlag) { // 終了時の処理
                    vue.sync = null; // DB削除
                    vue.dbSet(); // DB更新
                    window.location.reload(); // リロード
                    return;
                }
                if (vue.sync.startFlag) { // ゲーム開始時の処理
                    vue.sync.startFlag = false; // フラグを戻さないと無限ループ
                    await vue.dbSet(); // DB更新
                    await vue.initGame(); // 開始前処理
                    if (vue.isHost) { // ホストか？
                        if (vue.drawFlag) { // 二重実行回避用
                            // ホスト取得 -> ゲスト取得 -> ホスト更新 -> ゲスト更新の順に処理されて矛盾が出るので
                            setTimeout(function () { // ホスト側の処理を遅らせてゴリ押し回避
                                vue.drawCard(2);
                            }, 300);
                            vue.drawFlag = false;
                        }
                    } else {
                        if (vue.drawFlag) {
                            vue.drawCard(2);
                        }
                        vue.drawFlag = false;
                    }
                    $("#tmp").remove(); // 不要なDOMの削除
                    $("#start").remove();
                }
                vue.cardsUpdate(); // すでに引かれたカードを山から削除
                vue.oppUpdate(); // 相手のカードの更新
                vue.gameSet(); // 終了判定
            });
        },

        /**
         * DB更新
         */
        dbSet: function () {
            this.ref = db.ref(`/room/${this.roomId}`);
            this.ref.set(this.sync);
        },

        /**
         * ゲーム開始前処理 各項目の初期化
         */
        initGame: function () {
            this.cards = [];
            this.myCardHTML = "";
            this.deck = [];
            this.oppCardHTML = "";
            this.oneFlag = false;
            this.point = [0, 0];
            this.result = "";
            this.sync.hostStand = false;
            this.sync.guestStand = false;
            this.sync.hostPoint = 0;
            this.sync.guestPoint = 0;
            this.drawFlag = true;
            this.sync.timestamp = new Date().toLocaleString("ja");
            this.sync.hostCards = [new Card(suits[4], 999)];
            this.sync.guestCards = [new Card(suits[4], 999)];
            this.sync.drawnCards = [new Card(suits[4], 999)];
            // HitボタンとStandボタン追加
            this.selectHTML = `<a href="javascript:void(0);" class="btn btn-border" id="hit">Hit</a><a href="javascript:void(0);" class="btn btn-border" id="stand">Stand</a>`;
            this.cardSet();
            this.dbSet(); // DB更新
        },

        /**
         * すでに引かれたカードを山から削除
         */
        cardsUpdate: function () {
            for (let i = 0; i < this.sync.drawnCards.length; i++) { // 引かれたカード数分ループ
                for (let j = 0; j < this.cards.length; j++) { // 山の残り枚数分ループ
                    if (this.sync.drawnCards[i]["html"] === this.cards[j]["html"]) { // 一致していたら削除
                        this.cards.splice(j, 1);
                        break;
                    }
                }
            }
        },

        /**
         * 相手のカードの更新
         */
        oppUpdate: function () {
            this.oppCardHTML = ""; // 初期化
            if (this.isHost) {
                for (let i = 0; i < this.sync.guestCards.length - 1; i++) { // 相手のカード数分ループ
                    this.oppCardHTML += "<div class='card back'><p>？</p></div>"; // カードの裏面を追加
                }
            } else {
                for (let i = 0; i < this.sync.hostCards.length - 1; i++) {
                    this.oppCardHTML += "<div class='card back'><p>？</p></div>";
                }
            }
        },

        /**
         * カードの山の初期化
         */
        cardSet: function () {
            for (let i = 0; i < 4; i++) { // スート数分ループ
                for (let j = 1; j <= 13; j++) { // A~Kまでループ
                    let card = new Card(suits[i], j);
                    this.cards.push(card);
                }
            }
        },

        /**
         * カードを引く
         * @param {*} num 引く枚数
         */
        drawCard: function (num = 1) {
            for (let i = 0; i < num; i++) { // 引く枚数分ループ
                let rdm;
                let card = this.cards[0];
                let flg;
                while (true) {
                    rdm = Math.floor(Math.random() * this.cards.length); // 乱数生成
                    card = this.cards[rdm]; // ランダムに引く
                    flg = false;
                    this.setPush(); // ローカル情報更新
                    for (let i = 0; i < this.sync.drawnCards.length; i++) {
                        if (card["html"] === this.sync.drawnCards[i]["html"]) { // すでに引かれたカードと一致していたらやり直し
                            flg = true;
                            break;
                        }
                    }
                    if (flg) {
                        continue;
                    }
                    break;
                }
                this.deck.push(card); // 手札に追加
                this.pointPlus(card["num"]); // ポイント更新
                this.myCardHTML += card["html"]; // 手札のHTML追加
                this.sync.drawnCards.push(card); // すでに引かれたカードに追加
                if (this.isHost) {
                    this.sync.hostCards.push(card); // 引いたカードをDBに追加
                } else {
                    this.sync.guestCards.push(card);
                }
                this.dbSet(); // DB更新
            }
        },

        /**
         * ポイント加算
         * @param {*} num 数字
         */
        pointPlus: function (num) {
            if (num === 1) { // Aだったら+1か+11
                if (this.oneFlag) { // Aが出ていたら+1
                    this.point[0] += 1;
                    this.point[1] += 1;
                } else { // 出ていなかったら+1と+11
                    this.point[0] += 1;
                    this.point[1] += 11;
                    this.oneFlag = true;
                }
            } else if (num >= 10) { // 10以上だったら+10
                this.point[0] += 10;
                this.point[1] += 10;
            } else { // それ以外は+num
                this.point[0] += num;
                this.point[1] += num;
            }
        },

        /**
         * ポイント計算
         * @param {*} arr ポイントの入った配列
         * @returns 最適化されたポイント
         */
        pointCalc: function (arr) {
            return arr[1] <= 21 ? arr[1] : arr[0]; // 21以下かつ大きい方を返す
        },

        /**
         * Hit(もう一枚引く)
         */
        hit: async function () {
            await vue.drawCard(); // カードを引く
            if (this.pointCalc(this.point) > 21) { // バーストしたらスタンドの処理
                this.stand();
            }
        },

        /**
         * Stand(引くのをやめる)
         */
        stand: function () {
            this.selectHTML = ""; // ボタン削除
            if (this.isHost) {
                this.sync.hostStand = true;
                this.sync.hostPoint = this.pointCalc(this.point);
            } else {
                this.sync.guestStand = true;
                this.sync.guestPoint = this.pointCalc(this.point);
            }
            this.dbSet(); // DB更新
            this.setPush(); // ローカル情報更新
        },

        /**
         * 相手のカードを公開
         */
        cardOpen: function () {
            this.oppCardHTML = ""; // 初期化
            if (this.isHost) {
                for (let i = 1; i < this.sync.guestCards.length; i++) { // 相手のカード枚数分ループ
                    this.oppCardHTML += this.sync.guestCards[i]["html"]; // 相手のカード情報を追加
                }
            } else {
                for (let i = 1; i < this.sync.hostCards.length; i++) {
                    this.oppCardHTML += this.sync.hostCards[i]["html"];
                }
            }
        },

        /**
         * 終了判定
         */
        gameSet: async function () {
            if (this.sync.hostStand && this.sync.guestStand) { // どちらもスタンドしていたら終了
                this.sync.hostStand = false; // 無限ループ回避用
                await vue.dbSet(); // DB更新
                this.judge(); // 勝敗判定
                this.cardOpen(); // 相手のカードを公開
                if (this.isHost) {
                    // ContinueボタンとEndボタン追加
                    this.selectHTML = `<a href="javascript:void(0);" class="btn btn-border" id="continue">Continue</a><a href="javascript:void(0);" class="btn btn-border" id="end">End</a>`;
                } else {
                    // ゲストはEndボタンのみ追加
                    this.selectHTML = `<a href="javascript:void(0);" class="btn btn-border" id="end">End</a>`;
                }
            }
        },

        /**
         * 勝敗判定
         */
        judge: function () {
            const h = this.sync.hostPoint; // ホストのポイント
            const g = this.sync.guestPoint; // ゲストのポイント
            if (h === g || (h > 21 && g > 21)) { // 引き分け 同じ or 両方バースト
                this.result = "Draw";
            } else if (g > 21 || (h > g && h <= 21)) { // ホスト勝利 ゲストがバースト or ホストがバーストしてないかつゲストより上
                if (this.isHost) {
                    this.result = "Win!";
                } else {
                    this.result = "Lose...";
                }
            } else { // それ以外はゲスト勝利
                if (this.isHost) {
                    this.result = "Lose...";
                } else {
                    this.result = "Win!";
                }
            }
        }
    }
});

// 追加DOMだとv-on:clickが発火しないので呼び出し用
$("body").on("click", "#start", function () {
    vue.start();
});
$("body").on("click", "#hit", function () {
    vue.hit();
});
$("body").on("click", "#stand", function () {
    vue.stand();
});
$("body").on("click", "#continue", function () {
    vue.continueGame();
});
$("body").on("click", "#end", function () {
    vue.endGame();
});

/**
 * F5キー無効化
 * 仕様上vue.endGame()を実行しないとDBの情報が消えないので事故率低下のため
 */
$(document).on('keydown', function (e) {
    if ((e.which || e.keyCode) == 116) {
        return false;
    }
});